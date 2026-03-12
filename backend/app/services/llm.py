from __future__ import annotations

import json
import logging
import re
import time

import anthropic

from ..config import Config

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)
    return _client


def _repair_json(text: str) -> str:
    """Attempt common JSON repairs: strip markdown fences, fix trailing commas."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text.strip()


def call_llm(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int | None = None,
    retries: int = 3,
    parse_json: bool = True,
) -> dict | str:
    """Call Claude and return parsed JSON. Retries with exponential backoff."""
    client = _get_client()
    max_tokens = max_tokens or Config.LLM_MAX_TOKENS

    last_error = None
    for attempt in range(retries):
        try:
            response = client.messages.create(
                model=Config.LLM_MODEL,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            raw = response.content[0].text

            if not parse_json:
                return raw

            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                repaired = _repair_json(raw)
                try:
                    return json.loads(repaired)
                except json.JSONDecodeError:
                    if attempt < retries - 1:
                        logger.warning("JSON repair failed on attempt %d, retrying with stricter prompt", attempt + 1)
                        user_prompt = (
                            user_prompt
                            + "\n\nIMPORTANT: Your previous response was not valid JSON. "
                            "Return ONLY a raw JSON object with no markdown fences or extra text."
                        )
                        continue
                    raise

        except anthropic.BadRequestError:
            raise
        except anthropic.APIStatusError as e:
            last_error = e
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                logger.warning("Anthropic API error (attempt %d): %s. Retrying in %ds", attempt + 1, e, wait)
                time.sleep(wait)
            else:
                raise
        except anthropic.APIConnectionError as e:
            last_error = e
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                logger.warning("Anthropic connection error (attempt %d): %s. Retrying in %ds", attempt + 1, e, wait)
                time.sleep(wait)
            else:
                raise

    raise last_error  # type: ignore
