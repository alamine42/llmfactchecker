"""Tests for the claim extraction API."""

import pytest
from fastapi.testclient import TestClient

from factcheck.main import app
from factcheck.models import ClaimType


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


class TestExtractClaimsEndpoint:
    """Tests for the /api/extract-claims endpoint."""

    def test_extract_claims_statistical(self, client):
        """Test extraction of statistical claims."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "In 2024, 75% of users preferred AI assistants over traditional search.",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "claims" in data
        assert "processingTime" in data
        assert len(data["claims"]) >= 1

        # Should find at least the statistical claim
        claim_types = [c["type"] for c in data["claims"]]
        assert ClaimType.STATISTICAL.value in claim_types or ClaimType.TEMPORAL.value in claim_types

    def test_extract_claims_temporal(self, client):
        """Test extraction of temporal claims."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "The company was founded in 1999 and has grown significantly since then.",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["claims"]) >= 1
        claim_types = [c["type"] for c in data["claims"]]
        assert ClaimType.TEMPORAL.value in claim_types

    def test_extract_claims_factual(self, client):
        """Test extraction of factual claims."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "Paris is the capital of France and is located in Western Europe.",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["claims"]) >= 1
        claim_types = [c["type"] for c in data["claims"]]
        assert ClaimType.FACTUAL.value in claim_types

    def test_extract_claims_attribution(self, client):
        """Test extraction of attribution claims."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "According to recent studies, exercise improves mental health.",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["claims"]) >= 1
        claim_types = [c["type"] for c in data["claims"]]
        assert ClaimType.ATTRIBUTION.value in claim_types

    def test_extract_claims_comparative(self, client):
        """Test extraction of comparative claims."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "Python is faster than Ruby for most data processing tasks.",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["claims"]) >= 1
        claim_types = [c["type"] for c in data["claims"]]
        assert ClaimType.COMPARATIVE.value in claim_types

    def test_extract_claims_no_claims(self, client):
        """Test with text that has no extractable claims."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "Hello, how are you today?",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["claims"] == []

    def test_extract_claims_multiple_claims(self, client):
        """Test extraction of multiple claims from a paragraph."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": """Apple was founded in 1976 and is the largest technology company
                by market cap. According to Forbes, the company had over 150,000 employees
                in 2023. Their products are better than competitors in terms of user satisfaction.""",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should find multiple different claim types
        assert len(data["claims"]) >= 2

    def test_extract_claims_invalid_source(self, client):
        """Test with invalid source."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "Some text here.",
                "source": "invalid",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_extract_claims_empty_text(self, client):
        """Test with empty text."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "",
                "source": "chatgpt",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_extract_claims_with_response_id(self, client):
        """Test with optional response ID."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "The company was founded in 2020.",
                "source": "chatgpt",
                "responseId": "test-response-123",
            },
        )

        assert response.status_code == 200

    def test_extract_claims_claude_source(self, client):
        """Test with Claude as source."""
        response = client.post(
            "/api/extract-claims",
            json={
                "text": "In 2023, global temperatures reached record highs.",
                "source": "claude",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "claims" in data


class TestPatternExtractor:
    """Tests for the pattern extractor directly."""

    def test_percentage_pattern(self):
        """Test percentage detection."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        claims = extractor.extract("Studies show 85% of participants improved.")

        assert len(claims) >= 1
        assert any(c.type == ClaimType.STATISTICAL for c in claims)

    def test_year_pattern(self):
        """Test year detection."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        claims = extractor.extract("The technology was invented in 1989.")

        assert len(claims) >= 1
        assert any(c.type == ClaimType.TEMPORAL for c in claims)

    def test_superlative_pattern(self):
        """Test superlative detection."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        claims = extractor.extract("It is the largest building in the world.")

        assert len(claims) >= 1
        assert any(c.type == ClaimType.FACTUAL for c in claims)

    def test_sentence_extraction(self):
        """Test that full sentences are extracted."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        text = "First sentence. The company was founded in 2010. Last sentence."
        claims = extractor.extract(text)

        # Should extract the middle sentence
        if claims:
            assert "founded in 2010" in claims[0].text

    def test_deduplication(self):
        """Test that overlapping claims are deduplicated."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        # This sentence could match multiple patterns
        text = "In 2020, 50% of the population was affected by the change."
        claims = extractor.extract(text)

        # Should not have duplicate sentences
        texts = [c.text for c in claims]
        assert len(texts) == len(set(texts))

    def test_confidence_range(self):
        """Test that confidence is in valid range."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        claims = extractor.extract("The company has over 1 million users since 2019.")

        for claim in claims:
            assert 0 <= claim.confidence <= 1

    def test_source_offset(self):
        """Test that source offsets are correct."""
        from factcheck.extractors import PatternExtractor

        extractor = PatternExtractor()
        text = "The company was founded in 1999."
        claims = extractor.extract(text)

        if claims:
            offset = claims[0].source_offset
            assert offset is not None
            extracted = text[offset.start : offset.end]
            assert "founded" in extracted or "1999" in extracted
