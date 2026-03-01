"""Google Fact Check Tools API client."""

import asyncio
import logging
from dataclasses import dataclass

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class FactCheckResult:
    """A single fact-check result from the API."""

    publisher_name: str
    url: str
    rating: str
    published_date: str | None = None


class GoogleFactCheckClient:
    """Client for Google Fact Check Tools API."""

    BASE_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 1.0

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.google_api_key
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def search(self, query: str) -> list[FactCheckResult]:
        """Search for fact-checks related to the query.

        Args:
            query: The claim text to search for

        Returns:
            List of fact-check results from various publishers

        Raises:
            httpx.HTTPError: If the API request fails after retries
        """
        if not self.api_key:
            logger.warning("No Google API key configured, returning empty results")
            return []

        client = await self._get_client()
        params = {
            "key": self.api_key,
            "query": query,
            "languageCode": "en",
        }

        backoff = self.INITIAL_BACKOFF
        last_error: Exception | None = None

        for attempt in range(self.MAX_RETRIES):
            try:
                response = await client.get(self.BASE_URL, params=params)

                if response.status_code == 429:
                    # Rate limited, apply exponential backoff
                    logger.warning(
                        f"Rate limited, retrying in {backoff}s (attempt {attempt + 1})"
                    )
                    # Track rate limit as an error so we don't silently return empty
                    last_error = httpx.HTTPStatusError(
                        "Rate limit exceeded",
                        request=response.request,
                        response=response,
                    )
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue

                response.raise_for_status()

                # Parse JSON with error handling
                try:
                    data = response.json()
                except ValueError as e:
                    logger.error(f"Failed to parse JSON response: {e}")
                    raise httpx.DecodingError(str(e)) from e

                return self._parse_response(data)

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code >= 500:
                    # Server error, retry with backoff
                    logger.warning(
                        f"Server error {e.response.status_code}, "
                        f"retrying in {backoff}s (attempt {attempt + 1})"
                    )
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                # Client error (4xx except 429), don't retry
                logger.error(f"API client error: {e.response.status_code}")
                raise

            except (httpx.RequestError, httpx.DecodingError) as e:
                last_error = e
                logger.warning(
                    f"Request error, retrying in {backoff}s (attempt {attempt + 1}): {e}"
                )
                await asyncio.sleep(backoff)
                backoff *= 2
                continue

        # All retries exhausted
        if last_error:
            raise last_error
        return []

    def _parse_response(self, data: dict) -> list[FactCheckResult]:
        """Parse the API response into FactCheckResult objects."""
        results: list[FactCheckResult] = []

        claims = data.get("claims", [])
        for claim in claims:
            claim_reviews = claim.get("claimReview", [])
            for review in claim_reviews:
                publisher = review.get("publisher", {})
                results.append(
                    FactCheckResult(
                        publisher_name=publisher.get("name", "Unknown"),
                        url=review.get("url", ""),
                        rating=review.get("textualRating", "Unknown"),
                        published_date=review.get("reviewDate"),
                    )
                )

        return results
