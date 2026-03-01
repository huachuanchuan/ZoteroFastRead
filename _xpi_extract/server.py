from __future__ import annotations

import asyncio
import hashlib
import importlib
import json
import os
import re
import signal
import shutil
import socket
import subprocess
import sys
import textwrap
import uuid
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pypdf import PdfReader

_ORIG_MD5 = hashlib.md5
try:
    _ORIG_MD5(b"", usedforsecurity=False)
except TypeError:
    def _md5_compat(*args, **kwargs):
        kwargs.pop("usedforsecurity", None)
        return _ORIG_MD5(*args, **kwargs)

    hashlib.md5 = _md5_compat

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas


if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")


ROOT = Path(__file__).resolve().parent


def resolve_data_dir() -> Path:
    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / "fastread" / "data"
        return Path.home() / "AppData" / "Local" / "fastread" / "data"
    return ROOT / "data"


DATA_DIR = resolve_data_dir()
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"

DEFAULT_MODEL = "deepseek-chat"
DEFAULT_ENDPOINT = "https://api.deepseek.com/v1/chat/completions"
DEFAULT_SYSTEM_PROMPT = (
    "You are a professional academic translator. Translate the given text accurately and naturally "
    "into the target language. Keep technical terms precise and preserve list structure when present."
)
MAX_PAGE_CHARS = 6000

_BABELDOC_CHAT_COMPLETIONS_SUFFIX = "/chat/completions"


class TaskInfo(BaseModel):
    id: str
    status: str
    created_at: str
    updated_at: str
    document_name: str
    dualOutputUrl: Optional[str] = None
    monoOutputUrl: Optional[str] = None
    dualOutputPath: Optional[str] = None
    monoOutputPath: Optional[str] = None
    cacheKey: Optional[str] = None
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    ensure_dirs()
    try:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    except Exception:
        # Continue with fallback font if CID font registration fails.
        pass
    yield


app = FastAPI(title="fastRead Local Translation Bridge", version="0.2.0", lifespan=lifespan)
TASKS: Dict[str, TaskInfo] = {}
TASK_KEY_CACHE: Dict[str, str] = {}
_translate_pool = ThreadPoolExecutor(max_workers=5)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Accept-Ranges", "Content-Length", "Content-Range", "Content-Type"],
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def compute_pdf_hash(path: Path) -> str:
    md5 = hashlib.md5(usedforsecurity=False)
    with Path(path).open("rb") as source:
        while True:
            chunk = source.read(8192)
            if not chunk:
                break
            md5.update(chunk)
    return md5.hexdigest()


def trim_trailing_slash(value: str) -> str:
    return str(value or "").strip().rstrip("/")


def normalize_local_host(host: str) -> str:
    normalized = str(host or "").strip()
    if not normalized:
        return ""

    if ":" in normalized:
        name, port = normalized.rsplit(":", 1)
        if name.lower() == "localhost":
            return f"127.0.0.1:{port}"
        return normalized

    if normalized.lower() == "localhost":
        return "127.0.0.1"
    return normalized


def resolve_public_base_url(request: Request) -> str:
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").strip()
    forwarded_host = (request.headers.get("x-forwarded-host") or "").strip()
    host = normalize_local_host(forwarded_host or (request.headers.get("host") or "").strip())
    proto = forwarded_proto or request.url.scheme or "http"

    if host:
        return trim_trailing_slash(f"{proto}://{host}")

    return "http://127.0.0.1:8000"


def parse_model_config(value: Optional[str]) -> Dict[str, Any]:
    raw = (value or "").strip()
    if not raw:
        return {}

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if isinstance(parsed, dict):
        return parsed
    return {}


def read_api_key(request: Request, model_config: Dict[str, Any]) -> str:
    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            return token

    x_api_key = (request.headers.get("X-API-Key") or "").strip()
    if x_api_key:
        return x_api_key

    for key_name in ("apiKey", "api_key", "deepseekApiKey", "deepseek_api_key"):
        maybe = str(model_config.get(key_name) or "").strip()
        if maybe:
            return maybe

    env_key = os.environ.get("FASTREAD_DEEPSEEK_API_KEY", "").strip()
    if env_key:
        return env_key

    return ""


def resolve_endpoint(model_config: Dict[str, Any]) -> str:
    for key_name in ("endpoint", "apiBase", "api_base", "baseURL", "base_url"):
        value = str(model_config.get(key_name) or "").strip()
        if value:
            normalized = value.rstrip("/")
            if normalized.endswith("/chat/completions"):
                return normalized
            return f"{normalized}/chat/completions"
    return DEFAULT_ENDPOINT


def resolve_openai_base_url(endpoint: str) -> str:
    normalized = str(endpoint or "").strip().rstrip("/")
    if normalized.lower().endswith(_BABELDOC_CHAT_COMPLETIONS_SUFFIX):
        return normalized[: -len(_BABELDOC_CHAT_COMPLETIONS_SUFFIX)]
    return normalized


def serialize_cache_model_config(model_config: Dict[str, Any]) -> str:
    if not model_config:
        return ""
    try:
        return json.dumps(model_config, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return str(model_config)


def build_task_cache_key(
    *,
    pdf_hash: str,
    source_lang: str,
    target_lang: str,
    engine: str,
    provider_config_id: Optional[str],
    model_config: Dict[str, Any],
) -> str:
    source = str(source_lang or "").strip().lower()
    target = str(target_lang or "").strip().lower()
    engine_name = str(engine or "").strip().lower()
    provider = str(provider_config_id or "").strip()
    model_name = resolve_model(engine, model_config)
    endpoint = resolve_endpoint(model_config)
    model_config_json = serialize_cache_model_config(model_config)
    return "|".join([
        str(pdf_hash or "").strip().lower(),
        source,
        target,
        engine_name,
        provider,
        str(model_name or "").strip(),
        str(endpoint or "").strip(),
        model_config_json,
    ])


def resolve_babeldoc_qps() -> str:
    raw = str(os.environ.get("FASTREAD_BABELDOC_QPS", "")).strip()
    if raw.isdigit() and int(raw) > 0:
        return raw
    return "5"


def _babeldoc_python_commands() -> List[List[str]]:
    commands: List[List[str]] = []
    if os.name == "nt":
        commands.append(["py", "-3.12", "-m", "babeldoc.main"])
        commands.append([
            str(Path.home() / "AppData" / "Local" / "Programs" / "Python" / "Python312" / "python.exe"),
            "-m",
            "babeldoc.main",
        ])

    commands.append([sys.executable, "-m", "babeldoc.main"])
    return commands


def _pick_latest_file(candidates: List[Path]) -> Optional[Path]:
    existing = [path for path in candidates if path.exists() and path.is_file()]
    if not existing:
        return None
    return sorted(existing, key=lambda path: path.stat().st_mtime, reverse=True)[0]


def run_babeldoc_translation(
    *,
    input_pdf: Path,
    output_dir: Path,
    source_lang: str,
    target_lang: str,
    api_key: str,
    model: str,
    endpoint: str,
) -> Dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    openai_base_url = resolve_openai_base_url(endpoint)
    if not openai_base_url:
        raise RuntimeError("BabelDOC failed: invalid OpenAI base URL.")

    command_tail = [
        "--files",
        str(input_pdf),
        "--openai",
        "--openai-model",
        model,
        "--openai-base-url",
        openai_base_url,
        "--openai-api-key",
        api_key,
        "--lang-in",
        source_lang,
        "--lang-out",
        target_lang,
        "--output",
        str(output_dir),
        "--watermark-output-mode",
        "no_watermark",
        "--enhance-compatibility",
        "--qps",
        resolve_babeldoc_qps(),
        "--min-text-length",
        "1",
    ]

    last_error = "BabelDOC executable not found"
    for base_cmd in _babeldoc_python_commands():
        command = [*base_cmd, *command_tail]
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=7200,
                check=False,
                env={
                    **os.environ,
                    "PYTHONUTF8": "1",
                },
            )
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            raise RuntimeError("BabelDOC timed out after 7200 seconds.")

        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            stdout = (completed.stdout or "").strip()
            last_error = stderr or stdout or f"BabelDOC exited with code {completed.returncode}"
            continue

        dual_candidates = list(output_dir.glob(f"*.{target_lang}.dual.pdf"))
        mono_candidates = list(output_dir.glob(f"*.{target_lang}.mono.pdf"))

        dual_path = _pick_latest_file(dual_candidates)
        mono_path = _pick_latest_file(mono_candidates)
        if not dual_path:
            last_error = "BabelDOC finished but dual PDF output was not found."
            continue

        if not mono_path:
            mono_path = dual_path

        return {
            "dual": dual_path,
            "mono": mono_path,
        }

    raise RuntimeError(f"BabelDOC failed: {last_error}")


def sanitize_pdf_for_zotero(source_path: Path, destination_path: Path) -> None:
    source = Path(source_path)
    destination = Path(destination_path)
    if not source.exists():
        raise RuntimeError(f"PDF output not found: {source}")

    tmp_output = destination.with_suffix(f"{destination.suffix}.tmp")
    if tmp_output.exists():
        tmp_output.unlink()

    try:
        fitz_module = importlib.import_module("fitz")
        with fitz_module.open(str(source)) as pdf_doc:
            pdf_doc.save(str(tmp_output), garbage=4, deflate=True, clean=True, incremental=False)
        tmp_output.replace(destination)
        return
    except Exception:
        if tmp_output.exists():
            tmp_output.unlink()

    try:
        same_file = source.resolve() == destination.resolve()
    except Exception:
        same_file = False

    if same_file:
        return
    shutil.copy2(source, destination)


def mirror_pdf_output(source_path: Path, destination_path: Path) -> None:
    source = Path(source_path)
    destination = Path(destination_path)

    if not source.exists():
        raise RuntimeError(f"PDF output not found: {source}")

    try:
        if source.resolve() == destination.resolve():
            return
    except Exception:
        pass

    if destination.exists():
        destination.unlink()

    try:
        os.link(str(source), str(destination))
        return
    except OSError:
        pass

    shutil.copy2(source, destination)


def _is_true_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    value = str(raw).strip().lower()
    return value in {"1", "true", "yes", "on"}


def run_legacy_text_translation(
    *,
    upload_path: Path,
    output_dir: Path,
    source_lang: str,
    target_lang: str,
    engine: str,
    model_config: Dict[str, Any],
    api_key: str,
) -> Dict[str, Path]:
    endpoint = resolve_endpoint(model_config)
    model = resolve_model(engine, model_config)
    system_prompt = resolve_system_prompt(target_lang, model_config)

    pages_text = extract_pages_text(upload_path)
    translated_pages: List[str] = []

    for index, page_text in enumerate(pages_text, start=1):
        cleaned = (page_text or "").strip()
        if not cleaned:
            translated_pages.append("[No extractable text on this page]")
            continue

        chunks = chunk_text(cleaned)
        translated_chunks: List[str] = []
        for chunk in chunks:
            translated = call_deepseek_translate(
                endpoint=endpoint,
                api_key=api_key,
                model=model,
                source_lang=source_lang,
                target_lang=target_lang,
                system_prompt=system_prompt,
                text=chunk,
            )
            translated_chunks.append(translated)

        translated_page = "\n\n".join(part.strip() for part in translated_chunks if part.strip())
        translated_pages.append(translated_page or f"[Translation empty on page {index}]")

    if not translated_pages:
        raise RuntimeError("No pages found in PDF")

    dual_path = output_dir / "dual_output.pdf"
    mono_path = output_dir / "mono_output.pdf"
    write_text_pdf(translated_pages, dual_path, "fastRead Translated Output")
    write_text_pdf(translated_pages, mono_path, "fastRead Translated Output")
    return {
        "dual": dual_path,
        "mono": mono_path,
    }


async def run_legacy_text_translation_async(
    *,
    upload_path: Path,
    output_dir: Path,
    source_lang: str,
    target_lang: str,
    engine: str,
    model_config: Dict[str, Any],
    api_key: str,
) -> Dict[str, Path]:
    endpoint = resolve_endpoint(model_config)
    model = resolve_model(engine, model_config)
    system_prompt = resolve_system_prompt(target_lang, model_config)

    pages_text = extract_pages_text(upload_path)
    if not pages_text:
        raise RuntimeError("No pages found in PDF")

    loop = asyncio.get_running_loop()
    semaphore = asyncio.Semaphore(5)
    chunk_tasks: List[tuple[int, int, str]] = []

    for page_index, page_text in enumerate(pages_text):
        cleaned = (page_text or "").strip()
        if not cleaned:
            continue
        chunks = chunk_text(cleaned)
        for chunk_index, chunk in enumerate(chunks):
            if chunk.strip():
                chunk_tasks.append((page_index, chunk_index, chunk))

    async def _translate_one(task_item: tuple[int, int, str]) -> tuple[int, int, str]:
        page_index, chunk_index, chunk = task_item
        async with semaphore:
            translated = await loop.run_in_executor(
                _translate_pool,
                lambda: call_deepseek_translate(
                    endpoint=endpoint,
                    api_key=api_key,
                    model=model,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    system_prompt=system_prompt,
                    text=chunk,
                ),
            )
        return page_index, chunk_index, translated

    translated_results = await asyncio.gather(*[_translate_one(item) for item in chunk_tasks])

    translated_by_page: Dict[int, Dict[int, str]] = {}
    for page_index, chunk_index, translated in translated_results:
        if page_index not in translated_by_page:
            translated_by_page[page_index] = {}
        translated_by_page[page_index][chunk_index] = translated

    translated_pages: List[str] = []
    for page_index, page_text in enumerate(pages_text):
        cleaned = (page_text or "").strip()
        if not cleaned:
            translated_pages.append("[No extractable text on this page]")
            continue

        chunks = chunk_text(cleaned)
        ordered_chunks: List[str] = []
        for chunk_index in range(len(chunks)):
            translated = str(translated_by_page.get(page_index, {}).get(chunk_index, "")).strip()
            if translated:
                ordered_chunks.append(translated)
        translated_page = "\n\n".join(ordered_chunks)
        translated_pages.append(translated_page or f"[Translation empty on page {page_index + 1}]")

    dual_path = output_dir / "dual_output.pdf"
    mono_path = output_dir / "mono_output.pdf"
    write_text_pdf(translated_pages, dual_path, "fastRead Translated Output")
    write_text_pdf(translated_pages, mono_path, "fastRead Translated Output")
    return {
        "dual": dual_path,
        "mono": mono_path,
    }


def resolve_model(engine: str, model_config: Dict[str, Any]) -> str:
    maybe = str(model_config.get("model") or model_config.get("modelName") or "").strip()
    if maybe:
        return maybe
    if engine and engine.strip() and engine.strip().lower() not in {"openai", "default"}:
        return engine.strip()
    return DEFAULT_MODEL


def resolve_system_prompt(target_lang: str, model_config: Dict[str, Any]) -> str:
    custom = str(model_config.get("systemPrompt") or model_config.get("system_prompt") or "").strip()
    if custom:
        return custom
    return f"{DEFAULT_SYSTEM_PROMPT} Target language: {target_lang}."


def chunk_text(text: str, max_chars: int = MAX_PAGE_CHARS) -> List[str]:
    normalized = re.sub(r"\s+", " ", text or "").strip()
    if not normalized:
        return []
    if len(normalized) <= max_chars:
        return [normalized]

    chunks: List[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + max_chars)
        if end < len(normalized):
            split_at = normalized.rfind(" ", start, end)
            if split_at > start + 200:
                end = split_at
        chunks.append(normalized[start:end].strip())
        start = end
    return [part for part in chunks if part]


def call_deepseek_translate(
    *,
    endpoint: str,
    api_key: str,
    model: str,
    source_lang: str,
    target_lang: str,
    system_prompt: str,
    text: str,
) -> str:
    user_prompt = (
        f"Translate from {source_lang} to {target_lang}. "
        "Return only the translated text, without explanations.\n\n"
        f"{text}"
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    last_error = "DeepSeek request failed"
    for _attempt in range(3):
        try:
            response = requests.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=120,
            )
        except requests.RequestException as exc:
            last_error = str(exc)
            continue

        if response.status_code in {429, 500, 502, 503, 504}:
            last_error = f"HTTP {response.status_code} {response.text[:200]}"
            continue

        if response.status_code >= 400:
            raise RuntimeError(f"DeepSeek request failed: HTTP {response.status_code} {response.text[:300]}")

        data = response.json()
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            last_error = "DeepSeek response missing choices"
            continue

        message = choices[0].get("message") or {}
        content = str(message.get("content") or "").strip()
        if content:
            return content

        last_error = "DeepSeek response content is empty"

    raise RuntimeError(f"DeepSeek request failed after retries: {last_error}")


def extract_pages_text(pdf_path: Path) -> List[str]:
    reader = PdfReader(str(pdf_path))
    pages: List[str] = []
    for page in reader.pages:
        raw = page.extract_text() or ""
        pages.append(raw.strip())
    return pages


def write_text_pdf(text_pages: List[str], output_path: Path, title: str) -> None:
    c = canvas.Canvas(str(output_path), pagesize=A4)
    _, height = A4

    try:
        font_name = "STSong-Light"
        c.setFont(font_name, 10)
    except Exception:
        font_name = "Helvetica"
        c.setFont(font_name, 10)

    margin_x = 40
    margin_top = 42
    line_height = 14
    max_chars_per_line = 70

    for page_index, page_text in enumerate(text_pages, start=1):
        y = height - margin_top
        c.setFont(font_name, 10)
        c.drawString(margin_x, y, f"{title} - Page {page_index}")
        y -= line_height * 1.4

        content = (page_text or "").strip() or "[No extractable text on this page]"
        lines: List[str] = []
        for paragraph in content.split("\n"):
            paragraph = paragraph.strip()
            if not paragraph:
                lines.append("")
                continue
            wrapped = textwrap.wrap(paragraph, width=max_chars_per_line, break_long_words=True)
            lines.extend(wrapped if wrapped else [paragraph])

        for line in lines:
            if y < 30:
                c.showPage()
                c.setFont(font_name, 10)
                y = height - margin_top
            c.drawString(margin_x, y, line)
            y -= line_height

        c.showPage()

    c.save()


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "service": "fastread-server"}


@app.post("/shutdown")
async def shutdown() -> Dict[str, str]:
    os.kill(os.getpid(), signal.SIGTERM)
    return {"status": "shutting_down"}


@app.get("/api/tasks")
async def list_tasks(page: int = 1, pageSize: int = 20) -> Dict[str, Any]:
    items = list(TASKS.values())
    start = max(0, (page - 1) * pageSize)
    end = start + max(1, pageSize)
    return {
        "items": [item.model_dump() for item in items[start:end]],
        "page": page,
        "pageSize": pageSize,
        "total": len(items),
    }


@app.post("/api/tasks")
async def create_task(
    request: Request,
    file: UploadFile = File(...),
    document_name: str = Form("", alias="documentName"),
    task_type: str = Form("translation", alias="taskType"),
    source_lang: str = Form("en", alias="sourceLang"),
    target_lang: str = Form("zh", alias="targetLang"),
    engine: str = Form("openai", alias="engine"),
    priority: str = Form("normal", alias="priority"),
    provider_config_id: Optional[str] = Form(None, alias="providerConfigId"),
    model_config_input: Optional[str] = Form(None, alias="modelConfig"),
) -> Dict[str, Any]:
    if task_type != "translation":
        raise HTTPException(status_code=400, detail="Only translation taskType is supported")

    ensure_dirs()
    task_id = str(uuid.uuid4())
    task_upload_dir = UPLOAD_DIR / task_id
    task_output_dir = OUTPUT_DIR / task_id
    task_upload_dir.mkdir(parents=True, exist_ok=True)
    task_output_dir.mkdir(parents=True, exist_ok=True)

    original_name = document_name.strip() or file.filename or "document.pdf"
    upload_path = task_upload_dir / "input.pdf"

    with upload_path.open("wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            _ = f.write(chunk)

    model_config = parse_model_config(model_config_input)
    pdf_hash = compute_pdf_hash(upload_path)
    cache_key = build_task_cache_key(
        pdf_hash=pdf_hash,
        source_lang=source_lang,
        target_lang=target_lang,
        engine=engine,
        provider_config_id=provider_config_id,
        model_config=model_config,
    )
    cached_task_id = TASK_KEY_CACHE.get(cache_key)
    if cached_task_id:
        cached_task = TASKS.get(cached_task_id)
        if cached_task:
            if cached_task.status in {"queued", "processing"}:
                return {
                    "id": cached_task.id,
                    "status": cached_task.status,
                    "monoOutputUrl": cached_task.monoOutputUrl,
                    "dualOutputUrl": cached_task.dualOutputUrl,
                    "monoOutputPath": cached_task.monoOutputPath,
                    "dualOutputPath": cached_task.dualOutputPath,
                }

            if cached_task.status == "completed" and cached_task.monoOutputUrl:
                mono_value = str(cached_task.monoOutputPath or "").strip()
                dual_value = str(cached_task.dualOutputPath or "").strip()
                if mono_value and dual_value:
                    mono_path = Path(mono_value)
                    dual_path = Path(dual_value)
                    if mono_path.exists() and mono_path.is_file() and dual_path.exists() and dual_path.is_file():
                        return {
                            "id": cached_task.id,
                            "status": "completed",
                            "monoOutputUrl": cached_task.monoOutputUrl,
                            "dualOutputUrl": cached_task.dualOutputUrl,
                            "monoOutputPath": cached_task.monoOutputPath,
                            "dualOutputPath": cached_task.dualOutputPath,
                        }

    now = utc_now_iso()
    task = TaskInfo(
        id=task_id,
        status="queued",
        created_at=now,
        updated_at=now,
        document_name=original_name,
        cacheKey=cache_key,
    )
    TASKS[task_id] = task
    TASK_KEY_CACHE[cache_key] = task_id

    public_base_url = resolve_public_base_url(request)
    api_key = read_api_key(request, model_config)
    if not api_key:
        task.status = "failed"
        task.error = "Missing API key. Provide Authorization Bearer or X-API-Key."
        task.updated_at = utc_now_iso()
        return {"id": task_id, "status": task.status}

    _ = asyncio.create_task(
        run_translation_task(
            task_id=task_id,
            upload_path=upload_path,
            output_dir=task_output_dir,
            source_lang=source_lang,
            target_lang=target_lang,
            engine=engine,
            priority=priority,
            provider_config_id=provider_config_id,
            model_config=model_config,
            api_key=api_key,
            public_base_url=public_base_url,
        )
    )

    return {"id": task_id, "status": task.status}


async def run_translation_task(
    task_id: str,
    upload_path: Path,
    output_dir: Path,
    source_lang: str,
    target_lang: str,
    engine: str,
    priority: str,
    provider_config_id: Optional[str],
    model_config: Dict[str, Any],
    api_key: str,
    public_base_url: str,
) -> None:
    _ = priority
    _ = provider_config_id

    task = TASKS.get(task_id)
    if not task:
        return

    try:
        task.status = "processing"
        task.updated_at = utc_now_iso()

        endpoint = resolve_endpoint(model_config)
        model = resolve_model(engine, model_config)
        allow_plain_fallback = _is_true_env("FASTREAD_ALLOW_PLAIN_FALLBACK", False)
        dual_path = output_dir / "dual_output.pdf"
        mono_path = output_dir / "mono_output.pdf"

        try:
            babeldoc_result = run_babeldoc_translation(
                input_pdf=upload_path,
                output_dir=output_dir,
                source_lang=source_lang,
                target_lang=target_lang,
                api_key=api_key,
                model=model,
                endpoint=endpoint,
            )
            preferred_mono = babeldoc_result["mono"]
            sanitize_pdf_for_zotero(preferred_mono, mono_path)
            mirror_pdf_output(mono_path, dual_path)
        except Exception as babeldoc_error:
            if not allow_plain_fallback:
                raise RuntimeError(f"BabelDOC translation failed: {babeldoc_error}")

            legacy_result = await run_legacy_text_translation_async(
                upload_path=upload_path,
                output_dir=output_dir,
                source_lang=source_lang,
                target_lang=target_lang,
                engine=engine,
                model_config=model_config,
                api_key=api_key,
            )
            preferred_mono = legacy_result.get("mono") or legacy_result.get("dual")
            if not preferred_mono:
                raise RuntimeError("Legacy translation failed: missing output PDF path")
            sanitize_pdf_for_zotero(preferred_mono, mono_path)
            mirror_pdf_output(mono_path, dual_path)

        base_url = trim_trailing_slash(public_base_url) or "http://127.0.0.1:8000"
        task.dualOutputUrl = f"{base_url}/files/{task_id}/dual_output.pdf"
        task.monoOutputUrl = f"{base_url}/files/{task_id}/mono_output.pdf"
        task.dualOutputPath = str(dual_path)
        task.monoOutputPath = str(mono_path)
        task.status = "completed"
        task.updated_at = utc_now_iso()
    except Exception as exc:  # noqa: BLE001
        task.status = "failed"
        task.error = str(exc)
        task.updated_at = utc_now_iso()
        cache_key = str(task.cacheKey or "").strip()
        if cache_key and TASK_KEY_CACHE.get(cache_key) == task_id:
            TASK_KEY_CACHE.pop(cache_key, None)


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str) -> Dict[str, Any]:
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.model_dump()


@app.api_route("/files/{task_id}/{filename}", methods=["GET", "HEAD"])
async def get_output_file(task_id: str, filename: str) -> FileResponse:
    if filename not in {"dual_output.pdf", "mono_output.pdf"}:
        raise HTTPException(status_code=404, detail="Unsupported filename")

    file_path = OUTPUT_DIR / task_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
        "Access-Control-Allow-Headers": "Range,Content-Type,Authorization,X-API-Key",
        "Access-Control-Expose-Headers": "Accept-Ranges,Content-Length,Content-Range,Content-Type",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Disposition": f"inline; filename=\"{filename}\""
    }
    return FileResponse(str(file_path), media_type="application/pdf", headers=headers)


if __name__ == "__main__":
    import uvicorn

    def pick_bind_port() -> int:
        env_port = os.environ.get("FASTREAD_PORT", "").strip()
        if env_port.isdigit():
            return int(env_port)

        for candidate in (8000, 18000, 28000, 38000):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind(("127.0.0.1", candidate))
                return candidate
            except OSError:
                continue
            finally:
                sock.close()

        return 18000

    uvicorn.run(app, host="127.0.0.1", port=pick_bind_port(), reload=False)
