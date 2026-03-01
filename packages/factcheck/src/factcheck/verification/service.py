"""Verification service for fact-checking claims."""

import logging
import re
from datetime import datetime, timezone

from ..models import VerificationResult, VerificationSource, VerificationStatus
from .cache import VerificationCache
from .google_factcheck import GoogleFactCheckClient

logger = logging.getLogger(__name__)


class VerificationService:
    """Service for verifying claims using external fact-check APIs."""

    # Rating patterns that indicate verified/disputed status (word boundaries to avoid false matches)
    # Use negative lookbehind to exclude negated forms like "not verified", "never verified", "unverified"
    TRUE_PATTERNS = [
        r"\btrue\b", r"\bcorrect\b", r"\baccurate\b", r"\bmostly true\b",
        r"(?<!not\s)(?<!never\s)(?<!un)(?<!un-)\bverified\b"
    ]
    FALSE_PATTERNS = [
        r"\bfalse\b", r"\bincorrect\b", r"\binaccurate\b", r"\bmostly false\b",
        r"\bpants on fire\b", r"\bdisputed\b", r"\bmisleading\b"
        # Note: "unverified" is NOT included here - it should be treated as neutral/unclassified
    ]

    def __init__(
        self,
        google_client: GoogleFactCheckClient | None = None,
        cache: VerificationCache | None = None,
    ):
        """Initialize the verification service.

        Args:
            google_client: Google Fact Check API client (creates default if None)
            cache: Verification cache (creates default if None)
        """
        self.google_client = google_client or GoogleFactCheckClient()
        self.cache = cache or VerificationCache()

    async def verify(self, claim_text: str) -> VerificationResult:
        """Verify a claim using external fact-check sources.

        Args:
            claim_text: The claim text to verify

        Returns:
            VerificationResult with status, sources, and confidence
        """
        # Check cache first
        cached = self.cache.get(claim_text)
        if cached is not None:
            logger.debug(f"Cache hit for claim: {claim_text[:50]}...")
            return cached

        # Query Google Fact Check API
        try:
            fact_checks = await self.google_client.search(claim_text)
        except Exception as e:
            logger.error(f"Failed to query fact-check API: {e}")
            return self._create_error_result()

        # Convert to VerificationSource objects
        sources = [
            VerificationSource(
                name=fc.publisher_name,
                url=fc.url,
                verdict=fc.rating,
                published_date=fc.published_date,
            )
            for fc in fact_checks
        ]

        # Determine status and confidence from sources
        status, confidence = self._aggregate_results(sources)

        result = VerificationResult(
            status=status,
            sources=sources,
            confidence=confidence,
            verified_at=datetime.now(timezone.utc).isoformat(),
        )

        # Cache the result
        self.cache.set(claim_text, result)

        return result

    def _aggregate_results(
        self, sources: list[VerificationSource]
    ) -> tuple[VerificationStatus, float]:
        """Aggregate multiple fact-check sources into a single status.

        Args:
            sources: List of verification sources

        Returns:
            Tuple of (status, confidence)
        """
        if not sources:
            return VerificationStatus.UNVERIFIED, 0.0

        true_count = 0
        false_count = 0

        for source in sources:
            rating_lower = source.verdict.lower()
            # Use regex with word boundaries to avoid false matches (e.g., "unverified" != "verified")
            if any(re.search(pattern, rating_lower) for pattern in self.TRUE_PATTERNS):
                true_count += 1
            elif any(re.search(pattern, rating_lower) for pattern in self.FALSE_PATTERNS):
                false_count += 1

        total_classified = true_count + false_count

        if total_classified == 0:
            # No clear ratings found
            return VerificationStatus.UNVERIFIED, 0.3

        # Calculate confidence based on agreement
        confidence = max(true_count, false_count) / len(sources)

        if true_count > false_count:
            return VerificationStatus.VERIFIED, confidence
        elif false_count > true_count:
            return VerificationStatus.DISPUTED, confidence
        else:
            # Equal true/false counts
            return VerificationStatus.UNVERIFIED, 0.5

    def _create_error_result(self) -> VerificationResult:
        """Create an error verification result."""
        return VerificationResult(
            status=VerificationStatus.ERROR,
            sources=[],
            confidence=0.0,
            verified_at=datetime.now(timezone.utc).isoformat(),
        )

    async def close(self) -> None:
        """Clean up resources."""
        await self.google_client.close()
