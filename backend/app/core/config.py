from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache
import os
from pathlib import Path

# Locate backend root to load .env reliably
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    llm_provider: str = Field(default="ollama", alias="LLM_PROVIDER")
    ollama_base_url: str = Field(default="http://127.0.0.1:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="gemma4:e4b", alias="OLLAMA_MODEL")
    ollama_timeout_seconds: float = Field(default=180.0, alias="OLLAMA_TIMEOUT_SECONDS")
    ollama_num_ctx: int = Field(default=8192, alias="OLLAMA_NUM_CTX")
    ollama_keep_alive: str = Field(default="5m", alias="OLLAMA_KEEP_ALIVE")

    github_token: str = Field(default="", alias="GITHUB_TOKEN")
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    request_timeout_seconds: float = Field(default=15.0, alias="REQUEST_TIMEOUT_SECONDS")

    max_repository_files: int = Field(default=8, alias="MAX_REPOSITORY_FILES")
    max_file_chars: int = Field(default=6000, alias="MAX_FILE_CHARS")
    max_total_context_chars: int = Field(default=16000, alias="MAX_TOTAL_CONTEXT_CHARS")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
