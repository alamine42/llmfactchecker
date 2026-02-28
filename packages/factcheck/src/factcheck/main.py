"""FastAPI application for fact-checking."""

import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .extractors import PatternExtractor
from .models import ExtractClaimsRequest, ExtractClaimsResponse

app = FastAPI(
    title="GroundCheck Factcheck Service",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the pattern extractor
extractor = PatternExtractor()


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "groundcheck-factcheck",
        "version": "0.1.0",
    }


@app.post("/api/extract-claims")
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
