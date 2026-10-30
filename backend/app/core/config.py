"""Application configuration via pydantic-settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to backend/ directory regardless of cwd
_ENV_FILE = str(Path(__file__).resolve().parents[2] / ".env")


class Settings(BaseSettings):
    """Loupe application settings loaded from environment."""

    MODAL_API_KEY: str = "test-key-placeholder"
    MODAL_BASE_URL: str = "https://your-modal-shared-endpoint.modal.run/v1"
    MODEL_ID: str = "meta-models/Muse-Spark-Open-816B-A42B"
    APP_NAME: str = "Loupe"
    APP_ENV: str = "development"

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
