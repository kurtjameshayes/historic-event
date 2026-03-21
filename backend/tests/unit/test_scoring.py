from __future__ import annotations

import pytest
from app.services.scoring import (
    source_count_score,
    source_quality_score,
    compute_confidence,
    compute_coverage,
    QUALITY_SCORES,
)


class TestSourceCountScore:
    def test_zero_sources(self):
        assert source_count_score(0) == 0.0

    def test_one_source(self):
        assert source_count_score(1) == 0.3

    def test_two_sources(self):
        assert source_count_score(2) == 0.6

    def test_three_sources(self):
        assert source_count_score(3) == 1.0

    def test_many_sources(self):
        assert source_count_score(10) == 1.0


class TestSourceQualityScore:
    def test_empty_sources(self):
        assert source_quality_score([]) == 0.0

    def test_primary_sources(self):
        sources = [{"quality": "primary"}, {"quality": "primary"}]
        assert source_quality_score(sources) == 1.0

    def test_opinion_sources(self):
        sources = [{"quality": "opinion"}]
        assert source_quality_score(sources) == 0.2

    def test_mixed_sources(self):
        sources = [{"quality": "primary"}, {"quality": "tertiary"}]
        expected = (1.0 + 0.4) / 2
        assert source_quality_score(sources) == pytest.approx(expected)

    def test_missing_quality_defaults_to_tertiary(self):
        sources = [{}]
        assert source_quality_score(sources) == 0.4

    def test_unknown_quality_defaults_to_tertiary(self):
        sources = [{"quality": "unknown"}]
        assert source_quality_score(sources) == 0.4


class TestComputeConfidence:
    def test_no_sources(self):
        result = compute_confidence([])
        assert 0.0 <= result <= 1.0

    def test_high_confidence(self):
        sources = [{"quality": "primary"}] * 3
        result = compute_confidence(sources, agreement=1.0, extraction_confidence=1.0)
        assert result == pytest.approx(1.0)

    def test_low_confidence(self):
        result = compute_confidence([], agreement=0.0, extraction_confidence=0.0)
        assert result == 0.0

    def test_returns_float_in_range(self):
        sources = [{"quality": "secondary"}]
        result = compute_confidence(sources, agreement=0.5, extraction_confidence=0.6)
        assert 0.0 <= result <= 1.0


class TestComputeCoverage:
    def test_no_threads(self):
        assert compute_coverage([], [], []) == 0.0

    def test_single_well_covered_thread(self):
        threads = [{"id": "t1"}]
        events = [
            {"thread_id": "t1", "timestamp": 1000},
            {"thread_id": "t1", "timestamp": 2000},
            {"thread_id": "t1", "timestamp": 3000},
        ]
        edges = [
            {"thread_id": "t1", "confidence": 0.9},
            {"thread_id": "t1", "confidence": 0.8},
        ]
        result = compute_coverage(threads, events, edges)
        assert 0.0 < result <= 1.0

    def test_thread_with_few_events(self):
        threads = [{"id": "t1"}]
        events = [{"thread_id": "t1", "timestamp": 1000}]
        edges = [{"thread_id": "t1", "confidence": 0.5}]
        result = compute_coverage(threads, events, edges)
        assert result < 0.5

    def test_multiple_balanced_threads(self):
        threads = [{"id": "t1"}, {"id": "t2"}]
        events = [
            {"thread_id": "t1", "timestamp": i * 1000} for i in range(4)
        ] + [
            {"thread_id": "t2", "timestamp": i * 1000} for i in range(4)
        ]
        edges = [
            {"thread_id": "t1", "confidence": 0.9},
            {"thread_id": "t1", "confidence": 0.8},
            {"thread_id": "t2", "confidence": 0.85},
            {"thread_id": "t2", "confidence": 0.75},
        ]
        result = compute_coverage(threads, events, edges)
        assert result > 0.5

    def test_unbalanced_threads_lower_score(self):
        threads = [{"id": "t1"}, {"id": "t2"}]
        events = [{"thread_id": "t1", "timestamp": i * 1000} for i in range(10)]
        edges = [{"thread_id": "t1", "confidence": 0.9}]
        balanced = compute_coverage(
            threads,
            events + [{"thread_id": "t2", "timestamp": i * 1000} for i in range(10)],
            edges + [{"thread_id": "t2", "confidence": 0.9}],
        )
        unbalanced = compute_coverage(threads, events, edges)
        assert balanced > unbalanced

    def test_temporal_coverage_with_timespan(self):
        threads = [{"id": "t1"}]
        events = [
            {"thread_id": "t1", "timestamp": 0},
            {"thread_id": "t1", "timestamp": 100},
            {"thread_id": "t1", "timestamp": 200},
        ]
        edges = [
            {"thread_id": "t1", "confidence": 0.9},
            {"thread_id": "t1", "confidence": 0.8},
        ]
        result = compute_coverage(threads, events, edges, total_timespan_years=10)
        assert 0.0 <= result <= 1.0
