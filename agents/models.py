"""Connects to the AI provider chosen in .env.

LangChain's init_chat_model gives every provider the same interface, so the
agents don't care which one they're talking to.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

from .batch import ROOT

PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "key_var": "OPENAI_API_KEY",
        "model": "gpt-6.1-sol",
        # OpenAI's newest models need the Responses API for tool calls.
        "options": {"use_responses_api": True},
    },
    "gemini": {
        "name": "Gemini",
        "key_var": "GEMINI_API_KEY",
        "model": "gemini-3.8-flash",
        "langchain_provider": "google_genai",
    },
    "groq": {
        "name": "Groq",
        "key_var": "GROQ_API_KEY",
        "model": "openai/gpt-oss-120b",
    },
    "anthropic": {
        "name": "Anthropic",
        "key_var": "ANTHROPIC_API_KEY",
        "model": "claude-sonnet-5-5",
        "options": {"max_tokens": 16000},
        # Newer Claude models return structured replies through JSON schema,
        # not forced tool calls.
        "structured_method": "json_schema",
    },
    # Any service that speaks OpenAI's API: OpenRouter, Together, a local Ollama...
    "custom": {
        "name": "OpenAI-compatible service",
        "key_var": "LLM_API_KEY",
        "langchain_provider": "openai",
    },
}


class SetupError(Exception):
    """A problem with the setup, explained in plain words."""


@dataclass
class Settings:
    id: str
    name: str
    model: str
    langchain_provider: str
    api_key: str | None = None
    base_url: str | None = None
    options: dict = field(default_factory=dict)
    structured_method: str | None = None


def load_env() -> None:
    """Reads .env, if there is one, into the environment (without overriding)."""
    load_dotenv(ROOT / ".env")


def load_settings(env=os.environ) -> Settings:
    provider_id = env.get("LLM_PROVIDER", "").strip().lower()
    provider = PROVIDERS.get(provider_id)
    if not provider:
        raise SetupError(
            f"Set LLM_PROVIDER in .env to one of: {', '.join(PROVIDERS)}.\n"
            "Copy .env.example to .env to start (see README.md)."
        )
    settings = Settings(
        id=provider_id,
        name=provider["name"],
        model=env.get("LLM_MODEL") or provider.get("model", ""),
        langchain_provider=provider.get("langchain_provider", provider_id),
        api_key=env.get(provider["key_var"]) or env.get("LLM_API_KEY"),
        base_url=env.get("LLM_BASE_URL"),
        options=provider.get("options", {}),
        structured_method=provider.get("structured_method"),
    )
    if not settings.model:
        raise SetupError("Set LLM_MODEL in .env to the model you want to use.")
    if provider_id == "custom" and not settings.base_url:
        raise SetupError("Set LLM_BASE_URL in .env to your service's address, for example http://localhost:11434/v1")
    if provider_id != "custom" and not settings.api_key:
        raise SetupError(f"Add your {settings.name} API key to .env as {provider['key_var']}=...")
    return settings


def make_model(settings: Settings):
    options = {
        "model_provider": settings.langchain_provider,
        # Local services such as Ollama don't check the key, but the library wants one.
        "api_key": settings.api_key or "not-needed",
        # Wait and try again when the provider is busy or rate-limits us.
        "max_retries": 6,
        **settings.options,
    }
    if settings.id == "custom":
        options["base_url"] = settings.base_url
    return init_chat_model(settings.model, **options)


def structured(model, schema, settings: Settings):
    """The model, set up to reply in the exact shape of a Pydantic schema."""
    method = {"method": settings.structured_method} if settings.structured_method else {}
    return model.with_structured_output(schema, **method)
