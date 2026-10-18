#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import fetch_corpus
import pins

AVAILABLE_STATUSES = fetch_corpus.AVAILABLE_STATUSES - {'cached'}
RECORDED_STATUSES = (
    AVAILABLE_STATUSES
    | fetch_corpus.STRUCTURAL_EXCLUSION_STATUSES
    | {'failed'}
)


class CorpusValidationError(RuntimeError):
    pass


def _named(values: list[str], limit: int = 10) -> str:
    shown = ', '.join(values[:limit])
    return shown + (f' (+{len(values) - limit} more)' if len(values) > limit else '')


def read_object(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise CorpusValidationError(f'{path}: {exc}') from exc
    if not isinstance(value, dict):
        raise CorpusValidationError(f'{path}: expected a JSON object')
    return value


def read_snapshot(path: Path) -> list[dict]:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise CorpusValidationError(f'{path}: {exc}') from exc
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        raise CorpusValidationError(f'{path}: expected a JSON object array')
    return value


def require_int(value: object, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise CorpusValidationError(f'{name}: expected an integer')
    return value


def validate(
    root: Path, pinned_ids: set[str] | None = None
) -> tuple[int, int]:
    snapshot = read_snapshot(root / 'data' / 'registry.json')
    lock = read_object(root / 'corpus.lock.json')
    ready = read_object(root / 'corpus.ready.json')

    target_ids = [row.get('id') for row in snapshot if row.get('repo')]
    if not target_ids or not all(isinstance(pack_id, str) for pack_id in target_ids):
        raise CorpusValidationError('registry snapshot has invalid target ids')
    if len(set(target_ids)) != len(target_ids):
        raise CorpusValidationError('registry snapshot has duplicate target ids')

    packs = lock.get('packs')
    if not isinstance(packs, dict):
        raise CorpusValidationError('corpus.lock.json: packs must be an object')

    targets = require_int(ready.get('targets'), 'corpus.ready.json: targets')
    available = require_int(ready.get('available'), 'corpus.ready.json: available')
    floor = ready.get('coverageFloor')
    if not isinstance(floor, (int, float)) or isinstance(floor, bool):
        raise CorpusValidationError('corpus.ready.json: coverageFloor must be numeric')
    if targets != len(target_ids):
        raise CorpusValidationError(
            f'corpus.ready.json records {targets} targets; snapshot has {len(target_ids)}'
        )
    if not 0 < available <= targets:
        raise CorpusValidationError(
            f'corpus.ready.json has invalid population {available}/{targets}'
        )
    if floor != fetch_corpus.CORPUS_COVERAGE_FLOOR:
        raise CorpusValidationError(
            f'corpus.ready.json records coverage floor {floor}; code requires '
            f'{fetch_corpus.CORPUS_COVERAGE_FLOOR}'
        )

    target_set = set(target_ids)
    lock_set = set(packs)
    if lock_set != target_set:
        missing = sorted(target_set - lock_set)
        extra = sorted(lock_set - target_set)
        detail = []
        if missing:
            detail.append(f'missing {_named(missing)}')
        if extra:
            detail.append(f'extra {_named(extra)}')
        raise CorpusValidationError(
            'corpus lock does not match registry snapshot: ' + '; '.join(detail)
        )

    invalid_statuses = {
        pack_id: identity.get('status') if isinstance(identity, dict) else None
        for pack_id, identity in packs.items()
        if not isinstance(identity, dict)
        or identity.get('status') not in RECORDED_STATUSES
    }
    if invalid_statuses:
        raise CorpusValidationError(
            'corpus lock has invalid statuses: '
            + ', '.join(
                f'{pack_id}={status!r}'
                for pack_id, status in sorted(invalid_statuses.items())[:10]
            )
        )

    available_ids = {
        pack_id
        for pack_id, identity in packs.items()
        if isinstance(identity, dict)
        and identity.get('status') in AVAILABLE_STATUSES
    }
    if len(available_ids) != available:
        raise CorpusValidationError(
            f'corpus.ready.json records {available} available packs; lock has '
            f'{len(available_ids)}'
        )

    pinned = pinned_ids if pinned_ids is not None else set(pins.packs())
    coverage_ids = {
        pack_id
        for pack_id, identity in packs.items()
        if pack_id in pinned
        and identity['status']
        not in fetch_corpus.STRUCTURAL_EXCLUSION_STATUSES
    }
    coverage_available = len(coverage_ids & available_ids)
    recorded_coverage_available = require_int(
        ready.get('coverageAvailable'),
        'corpus.ready.json: coverageAvailable',
    )
    recorded_coverage_targets = require_int(
        ready.get('coverageTargets'),
        'corpus.ready.json: coverageTargets',
    )
    if (
        recorded_coverage_available != coverage_available
        or recorded_coverage_targets != len(coverage_ids)
    ):
        raise CorpusValidationError(
            'corpus.ready.json records coverage population '
            f'{recorded_coverage_available}/{recorded_coverage_targets}; '
            f'lock and pins have {coverage_available}/{len(coverage_ids)}'
        )
    if fetch_corpus.population_is_too_small(
        coverage_available, len(coverage_ids)
    ):
        raise CorpusValidationError(
            f'eligible corpus population {coverage_available}/{len(coverage_ids)} '
            f'is below the {fetch_corpus.CORPUS_COVERAGE_FLOOR:.0%} floor'
        )

    corpus = root / 'corpus' / 'registry_js'
    for pack_id in sorted(available_ids):
        identity = packs[pack_id]
        if not isinstance(identity.get('ref'), str) or not identity['ref']:
            raise CorpusValidationError(f'{pack_id}: lock has no resolved ref')
        pack_dir = corpus / pack_id
        if not (pack_dir / '.done').is_file():
            raise CorpusValidationError(f'{pack_id}: staged corpus is incomplete')
        staged_identity = read_object(pack_dir / '.identity')
        expected = {
            'etag': identity.get('etag', ''),
            'ref': identity['ref'],
        }
        if staged_identity != expected:
            raise CorpusValidationError(f'{pack_id}: staged identity differs from lock')

    return available, targets


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--root',
        type=Path,
        default=Path(os.environ.get('CENSUS_ROOT', '.census')),
    )
    args = parser.parse_args()
    try:
        available, targets = validate(args.root.resolve())
    except CorpusValidationError as exc:
        print(f'corpus cache invalid: {exc}')
        return 1
    print(f'corpus cache valid: {available}/{targets} targets available')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
