"""TTL cache for verification results."""

import hashlib
from typing import TYPE_CHECKING

from cachetools import TTLCache

from ..config import settings

if TYPE_CHECKING:
    from ..models import VerificationResult


class VerificationCache:
    """In-memory TTL cache for verification results."""

    def __init__(self, maxsize: int = 1000, ttl: int | None = None):
        """Initialize the cache.

        Args:
            maxsize: Maximum number of items in the cache
            ttl: Time-to-live in seconds (defaults to config setting)
        """
        self._cache: TTLCache = TTLCache(
            maxsize=maxsize,
            ttl=ttl or settings.cache_ttl_seconds,
        )

    def _make_key(self, claim_text: str) -> str:
        """Create a cache key from claim text."""
        # Normalize text and create hash for consistent keys
        normalized = claim_text.strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def get(self, claim_text: str) -> "VerificationResult | None":
        """Get a cached verification result.

        Args:
            claim_text: The claim text to look up

        Returns:
            The cached VerificationResult or None if not found
        """
        key = self._make_key(claim_text)
        return self._cache.get(key)

    def set(self, claim_text: str, result: "VerificationResult") -> None:
        """Cache a verification result.

        Args:
            claim_text: The claim text as key
            result: The verification result to cache
        """
        key = self._make_key(claim_text)
        self._cache[key] = result

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    def __len__(self) -> int:
        """Return the number of cached entries."""
        return len(self._cache)
