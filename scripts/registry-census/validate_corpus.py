#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

AVAILABLE_STATUSES = {'empty', 'ok'}


class CorpusValidationError(RuntimeError):
    pass


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


def validate(root: Path) -> tuple[int, int]:
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
    if not 0 < floor <= 1:
        raise CorpusValidationError(
            f'corpus.ready.json has invalid coverage floor {floor}'
        )
    if targets - available >= 5 and available / targets < floor:
        raise CorpusValidationError(
            f'corpus population {available}/{targets} is below the {floor:.0%} floor'
        )

    target_set = set(target_ids)
    available_ids = {
        pack_id
        for pack_id, identity in packs.items()
        if isinstance(identity, dict)
        and identity.get('status') in AVAILABLE_STATUSES
    }
    extra_ids = available_ids - target_set
    if extra_ids:
        raise CorpusValidationError(
            f'corpus lock contains {len(extra_ids)} available packs outside the snapshot'
        )
    if len(available_ids) != available:
        raise CorpusValidationError(
            f'corpus.ready.json records {available} available packs; lock has '
            f'{len(available_ids)}'
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
