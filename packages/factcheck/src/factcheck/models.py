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
