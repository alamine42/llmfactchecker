"""Configuration settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_prefix="FACTCHECK_",
        env_file=".env.local",
        env_file_encoding="utf-8",
    )

    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]

    # Google Fact Check API
    google_api_key: str = ""

    # Cache settings
    cache_ttl_seconds: int = 3600  # 1 hour


settings = Settings()
