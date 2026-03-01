"""FastAPI application for fact-checking."""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .extractors import PatternExtractor
from .models import (
    ExtractClaimsRequest,
    ExtractClaimsResponse,
    VerifyClaimRequest,
    VerifyClaimResponse,
)
from .verification import VerificationService

# Initialize services
extractor = PatternExtractor()
verification_service = VerificationService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    yield
    # Cleanup on shutdown
    await verification_service.close()


app = FastAPI(
    title="GroundCheck Factcheck Service",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "groundcheck-factcheck",
        "version": "0.1.0",
    }


@app.post("/api/extract-claims", response_model=ExtractClaimsResponse)
def extract_claims(request: ExtractClaimsRequest) -> ExtractClaimsResponse:
    """Extract factual claims from text.

    This is a sync endpoint so FastAPI runs the CPU-bound regex extraction
    in a threadpool, avoiding blocking the event loop.

    Args:
        request: The extraction request containing text and source

    Returns:
        Response with extracted claims and processing time
    """
    start_time = time.perf_counter()

    claims = extractor.extract(request.text)

    processing_time = time.perf_counter() - start_time

    return ExtractClaimsResponse(claims=claims, processing_time=processing_time)


@app.post("/api/verify-claim", response_model=VerifyClaimResponse)
async def verify_claim(request: VerifyClaimRequest) -> VerifyClaimResponse:
    """Verify a claim using external fact-check sources.

    Queries the Google Fact Check Tools API and aggregates results
    from professional fact-checkers.

    Args:
        request: The verification request containing claim ID and text

    Returns:
        Response with verification status and sources
    """
    verification = await verification_service.verify(request.claim_text)

    return VerifyClaimResponse(claim_id=request.claim_id, verification=verification)
