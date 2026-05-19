from __future__ import annotations

import base64
import io
import logging
import re
from urllib.parse import urlparse

import anthropic

from ..config import Config

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 15_000
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)
    return _client


def _truncate(text: str) -> str:
    if len(text) <= MAX_TEXT_LENGTH:
        return text
    return text[:MAX_TEXT_LENGTH] + f"\n\n[Content truncated at {MAX_TEXT_LENGTH} characters]"


def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using pdfplumber."""
    import pdfplumber

    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
    full = "\n\n".join(pages)
    if not full.strip():
        return "[No readable text found in PDF]"
    return _truncate(full)


def parse_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full = "\n\n".join(paragraphs)
    if not full.strip():
        return "[No readable text found in DOCX]"
    return _truncate(full)


def parse_image(file_bytes: bytes, mime_type: str) -> str:
    """Extract text/description from an image using Claude vision."""
    client = _get_client()
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    response = client.messages.create(
        model=Config.LLM_MODEL,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Please extract and transcribe all text visible in this image. "
                            "If there is no text, describe the image content in detail so it can be used as research context."
                        ),
                    },
                ],
            }
        ],
        timeout=60.0,
    )
    if not response.content:
        return "[No content extracted from image]"
    return _truncate(response.content[0].text.strip())


def crawl_url(url: str) -> str:
    """Fetch a URL and extract readable text content using BeautifulSoup."""
    import requests
    from bs4 import BeautifulSoup

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme!r}. Only http/https are allowed.")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; HistoricEventBot/1.0; +https://github.com/historic-event)"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
    resp.raise_for_status()

    content_type = resp.headers.get("Content-Type", "")
    if "html" not in content_type and "text" not in content_type:
        raise ValueError(f"URL returned non-text content type: {content_type!r}")

    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "iframe"]):
        tag.decompose()

    main = (
        soup.find("article")
        or soup.find("main")
        or soup.find(id=re.compile(r"content|article|main", re.I))
        or soup.find(class_=re.compile(r"content|article|main|post|body", re.I))
        or soup.find("body")
    )

    if main is None:
        return "[Could not extract text from URL]"

    lines = [line.strip() for line in main.get_text(separator="\n").splitlines()]
    cleaned = "\n".join(line for line in lines if line)

    if not cleaned.strip():
        return "[No readable text found at URL]"
    return _truncate(cleaned)
