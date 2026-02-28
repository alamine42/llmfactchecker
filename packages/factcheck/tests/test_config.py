"""Tests for configuration settings."""

import os
from unittest.mock import patch


def test_settings_reads_env_prefix() -> None:
    """Settings respects FACTCHECK_ environment prefix."""
    with patch.dict(os.environ, {"FACTCHECK_DEBUG": "false"}):
        # Import fresh to pick up env changes
        from importlib import reload

        import factcheck.config

        reload(factcheck.config)
        assert factcheck.config.settings.debug is False


def test_settings_default_debug_true() -> None:
    """Settings defaults debug to True."""
    from factcheck.config import Settings

    settings = Settings()
    assert settings.debug is True


def test_settings_default_cors_origins() -> None:
    """Settings has default CORS origins."""
    from factcheck.config import Settings

    settings = Settings()
    assert "http://localhost:3000" in settings.cors_origins
