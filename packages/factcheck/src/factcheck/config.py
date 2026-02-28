"""Configuration settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(env_prefix="FACTCHECK_")

    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
