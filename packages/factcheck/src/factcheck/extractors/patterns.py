"""Pattern-based claim extractor."""

import re
import uuid
from dataclasses import dataclass

from ..models import Claim, ClaimType, SourceOffset


@dataclass
class PatternMatch:
    """A pattern match result."""

    start: int
    end: int
    match_text: str
    claim_type: ClaimType


class PatternExtractor:
    """Extract claims from text using regex patterns."""

    # Patterns for different claim types
    PATTERNS: dict[ClaimType, list[re.Pattern[str]]] = {
        ClaimType.STATISTICAL: [
            # Percentages: "75% of users", "increased by 50%"
            re.compile(r"\b(\d+(?:\.\d+)?%)\s*(?:of|increase|decrease|growth|decline)", re.I),
            # Numbers with context: "over 1 million users", "approximately 500"
            re.compile(r"\b(?:over|about|approximately|roughly|nearly|around)\s+(\d[\d,\.]*)\s+\w+", re.I),
            # Specific numbers: "has 2.5 billion users"
            re.compile(r"\b(?:has|have|had|with)\s+(\d[\d,\.]*)\s*(?:million|billion|thousand|users|people|customers)", re.I),
        ],
        ClaimType.TEMPORAL: [
            # Year references: "in 2024", "since 1999"
            re.compile(r"\b(?:in|since|from|during|by)\s+(\d{4})\b", re.I),
            # Founded/established dates
            re.compile(r"\b(?:founded|established|created|launched|started)\s+(?:in\s+)?(\d{4})\b", re.I),
            # Specific dates
            re.compile(r"\b(?:on|in)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b", re.I),
        ],
        ClaimType.FACTUAL: [
            # Superlatives: "is the first", "is the largest"
            re.compile(r"\b(?:is|are|was|were)\s+(?:the\s+)?(?:first|largest|smallest|biggest|oldest|newest|most|least|only)\b", re.I),
            # Definitive statements: "X is the capital of Y"
            re.compile(r"\b(?:is|are)\s+(?:the\s+)?(?:capital|founder|CEO|president|inventor|creator)\s+of\b", re.I),
            # Location claims
            re.compile(r"\b(?:located|based|headquartered)\s+in\b", re.I),
        ],
        ClaimType.ATTRIBUTION: [
            # "According to X", "X said"
            re.compile(r"\baccording\s+to\s+", re.I),
            # Reported by
            re.compile(r"\b(?:reported|stated|announced|claimed|said)\s+(?:by|that)\b", re.I),
            # Research/study references
            re.compile(r"\b(?:research|study|survey|report)\s+(?:by|from|shows|found)\b", re.I),
        ],
        ClaimType.COMPARATIVE: [
            # Comparisons: "X is better than Y", "faster than"
            re.compile(r"\b(?:better|worse|faster|slower|larger|smaller|more|less)\s+than\b", re.I),
            # Rankings
            re.compile(r"\b(?:ranked|ranks)\s+(?:\#?\d+|first|second|third)\b", re.I),
            # Outperform/exceed
            re.compile(r"\b(?:outperforms?|exceeds?|surpasses?)\b", re.I),
        ],
    }

    # Base confidence for pattern matching (can be adjusted by context)
    BASE_CONFIDENCE = 0.6

    def extract(self, text: str) -> list[Claim]:
        """Extract claims from text using pattern matching.

        Args:
            text: The text to extract claims from

        Returns:
            List of extracted claims
        """
        matches: list[PatternMatch] = []

        for claim_type, patterns in self.PATTERNS.items():
            for pattern in patterns:
                for match in pattern.finditer(text):
                    matches.append(
                        PatternMatch(
                            start=match.start(),
                            end=match.end(),
                            match_text=match.group(0),
                            claim_type=claim_type,
                        )
                    )

        # Extract full sentences containing matches
        claims = self._matches_to_claims(text, matches)

        # Deduplicate overlapping claims
        claims = self._deduplicate_claims(claims)

        return claims

    def _matches_to_claims(self, text: str, matches: list[PatternMatch]) -> list[Claim]:
        """Convert pattern matches to claims with full sentence context."""
        claims: list[Claim] = []
        seen_sentences: set[str] = set()

        for match in matches:
            # Find the sentence containing this match
            sentence_start = self._find_sentence_start(text, match.start)
            sentence_end = self._find_sentence_end(text, match.end)

            sentence = text[sentence_start:sentence_end].strip()

            # Skip if we've already seen this sentence
            if sentence in seen_sentences:
                continue
            seen_sentences.add(sentence)

            # Skip very short or very long sentences
            if len(sentence) < 10 or len(sentence) > 500:
                continue

            claims.append(
                Claim(
                    id=str(uuid.uuid4()),
                    text=sentence,
                    type=match.claim_type,
                    confidence=self.BASE_CONFIDENCE,
                    source_offset=SourceOffset(start=sentence_start, end=sentence_end),
                )
            )

        return claims

    def _find_sentence_start(self, text: str, pos: int) -> int:
        """Find the start of the sentence containing position pos."""
        # Look backwards for sentence boundary
        sentence_endings = ".!?\n"
        start = pos
        while start > 0:
            if text[start - 1] in sentence_endings:
                break
            start -= 1
        return start

    def _find_sentence_end(self, text: str, pos: int) -> int:
        """Find the end of the sentence containing position pos."""
        # Look forwards for sentence boundary
        sentence_endings = ".!?\n"
        end = pos
        while end < len(text):
            if text[end] in sentence_endings:
                end += 1  # Include the ending punctuation
                break
            end += 1
        return end

    def _deduplicate_claims(self, claims: list[Claim]) -> list[Claim]:
        """Remove duplicate claims based on text overlap."""
        if not claims:
            return claims

        # Sort by source offset start position
        sorted_claims = sorted(
            claims, key=lambda c: c.source_offset.start if c.source_offset else 0
        )

        result: list[Claim] = []
        for claim in sorted_claims:
            # Check if this claim overlaps significantly with any existing claim
            is_duplicate = False
            for existing in result:
                if self._claims_overlap(claim, existing):
                    is_duplicate = True
                    break

            if not is_duplicate:
                result.append(claim)

        return result

    def _claims_overlap(self, claim1: Claim, claim2: Claim) -> bool:
        """Check if two claims have significant text overlap."""
        if not claim1.source_offset or not claim2.source_offset:
            return claim1.text == claim2.text

        start1, end1 = claim1.source_offset.start, claim1.source_offset.end
        start2, end2 = claim2.source_offset.start, claim2.source_offset.end

        # Check for overlap
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)

        if overlap_end <= overlap_start:
            return False

        # Significant overlap if more than 50% of either claim overlaps
        overlap_len = overlap_end - overlap_start
        len1 = end1 - start1
        len2 = end2 - start2

        return overlap_len > 0.5 * min(len1, len2)
