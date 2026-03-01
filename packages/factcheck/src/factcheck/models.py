"""Pydantic models for fact-checking."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ClaimType(str, Enum):
    """Types of claims that can be extracted."""

    FACTUAL = "factual"
    STATISTICAL = "statistical"
    ATTRIBUTION = "attribution"
    TEMPORAL = "temporal"
    COMPARATIVE = "comparative"


class SourceOffset(BaseModel):
    """Source text location for a claim."""

    start: int
    end: int


class Claim(BaseModel):
    """A single extracted claim."""

    id: str
    text: str
    type: ClaimType
    confidence: float = Field(ge=0, le=1)
    source_offset: SourceOffset | None = Field(default=None, alias="sourceOffset")

    model_config = {"populate_by_name": True}


class ExtractClaimsRequest(BaseModel):
    """Request to extract claims from text."""

    # Max 50KB of text to prevent DoS via CPU-intensive regex processing
    text: str = Field(min_length=1, max_length=50000)
    source: Literal["chatgpt", "claude"]
    response_id: str | None = Field(default=None, alias="responseId")

    model_config = {"populate_by_name": True}


class ExtractClaimsResponse(BaseModel):
    """Response containing extracted claims."""

    claims: list[Claim]
    processing_time: float | None = Field(default=None, alias="processingTime")

    model_config = {"populate_by_name": True, "by_alias": True}


class VerificationStatus(str, Enum):
    """Status of a verification result."""

    PENDING = "pending"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    UNVERIFIED = "unverified"
    ERROR = "error"


class VerificationSource(BaseModel):
    """A source from a fact-check organization."""

    name: str  # "PolitiFact", "Snopes"
    url: str  # Link to fact-check article
    verdict: str  # "True", "False", "Misleading"
    published_date: str | None = Field(default=None, alias="publishedDate")

    model_config = {"populate_by_name": True, "by_alias": True}


class VerificationResult(BaseModel):
    """Result of verifying a claim."""

    status: VerificationStatus
    sources: list[VerificationSource]
    confidence: float = Field(ge=0, le=1)
    verified_at: str = Field(alias="verifiedAt")

    model_config = {"populate_by_name": True, "by_alias": True}


class VerifyClaimRequest(BaseModel):
    """Request to verify a claim."""

    claim_id: str = Field(alias="claimId")
    claim_text: str = Field(min_length=1, max_length=2000, alias="claimText")
    claim_type: ClaimType = Field(alias="claimType")

    model_config = {"populate_by_name": True}


class VerifyClaimResponse(BaseModel):
    """Response containing verification result."""

    claim_id: str = Field(alias="claimId")
    verification: VerificationResult

    model_config = {"populate_by_name": True, "by_alias": True}
