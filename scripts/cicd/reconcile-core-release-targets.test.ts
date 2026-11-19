import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

function reconciliation({
  apply = true,
  existing = true,
  failFreeze = false,
  stale = false,
  retired = 'core/1.58 core/1.59',
  active = 'core/1.60 core/1.61'
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'core-retirement-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(
    join(directory, 'rulesets.json'),
    JSON.stringify([
      [
        {
          id: 7,
          name: 'Core release branches',
          rules: [{ type: 'pull_request' }]
        },
        ...(existing ? [{ id: 9, name: 'Retired core release lines' }] : [])
      ]
    ])
  )
  writeFileSync(
    join(directory, 'labels.json'),
    JSON.stringify([
      'core/1.9',
      'core/1.59',
      '1.59',
      'branch:core/1.59',
      'backport:core/1.59',
      'core/1.60',
      'core/1.61',
      'cloud/1.59',
      'area:cloud',
      'backport'
    ])
  )
  writeFileSync(join(directory, 'writes'), '')
  writeFileSync(
    join(directory, 'git'),
    '#!/bin/sh\nprintf "%s\\trefs/heads/master\\n" "$LATEST_SHA"\n',
    { mode: 0o755 }
  )
  writeFileSync(
    join(directory, 'gh'),
    `#!/bin/bash
set -euo pipefail
if [ "$1 $2" = 'api --method' ]; then
  [ "$FAIL_FREEZE" != true ] || exit 1
  cat > "$STATE/request.json"
  echo "$3 $4" >> "$STATE/writes"
elif [ "$1" = api ]; then
  case "$2" in
    */rulesets) cat "$STATE/rulesets.json" ;;
    */labels) jq -r '.[]' "$STATE/labels.json" ;;
    *) exit 2 ;;
  esac
elif [ "$1 $2" = 'label create' ]; then
  jq --arg name "$3" '. + [$name] | unique' "$STATE/labels.json" > "$STATE/labels.next"
  mv "$STATE/labels.next" "$STATE/labels.json"
  echo "$*" >> "$STATE/writes"
elif [ "$1 $2" = 'label delete' ]; then
  jq --arg name "$3" 'map(select(. != $name))' "$STATE/labels.json" > "$STATE/labels.next"
  mv "$STATE/labels.next" "$STATE/labels.json"
  echo "$*" >> "$STATE/writes"
else
  exit 2
fi
`,
    { mode: 0o755 }
  )

  const run = () =>
    spawnSync(
      'bash',
      [
        '--noprofile',
        '--norc',
        'scripts/cicd/reconcile-core-release-targets.sh'
      ],
      {
        encoding: 'utf8',
        env: {
          PATH: `${directory}:${process.env.PATH}`,
          STATE: directory,
          GH_REPO: 'Comfy-Org/ComfyUI_frontend',
          ACTIVE_CORE_TARGETS: active,
          RETIRED_CORE_TARGETS: retired,
          MINIMUM_CORE_TARGET: active.split(' ')[0],
          COMFYUI_PIN_SHA: 'pin-sha',
          LATEST_SHA: stale ? 'changed-pin' : 'pin-sha',
          APPLY: String(apply),
          FAIL_FREEZE: String(failFreeze)
        }
      }
    )
  return { directory, run }
}

describe('core retirement reconciliation', () => {
  it('creates a separate freeze ruleset on the first run', () => {
    const { directory, run } = reconciliation({ existing: false })

    expect(run().status).toBe(0)

    expect(readFileSync(join(directory, 'writes'), 'utf8')).toContain(
      'POST repos/Comfy-Org/ComfyUI_frontend/rulesets'
    )
  })

  it('freezes only obsolete refs and prunes their labels idempotently', () => {
    const { directory, run } = reconciliation()

    expect(run().status).toBe(0)
    expect(run().status).toBe(0)

    expect(
      JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8'))
    ).toEqual({
      name: 'Retired core release lines',
      target: 'branch',
      enforcement: 'active',
      bypass_actors: [],
      conditions: {
        ref_name: {
          include: ['refs/heads/core/1.58', 'refs/heads/core/1.59'],
          exclude: []
        }
      },
      rules: [
        {
          type: 'update',
          parameters: { update_allows_fetch_and_merge: false }
        },
        { type: 'deletion' },
        { type: 'non_fast_forward' }
      ]
    })
    expect(
      JSON.parse(readFileSync(join(directory, 'labels.json'), 'utf8'))
    ).toEqual([
      'area:cloud',
      'backport',
      'cloud/1.59',
      'core/1.60',
      'core/1.61'
    ])
    expect(readFileSync(join(directory, 'writes'), 'utf8')).not.toContain(
      'rulesets/7'
    )
  })

  it('unfreezes a rolled-back line and recreates its backport label', () => {
    const { directory, run } = reconciliation({
      active: 'core/1.58 core/1.59 core/1.60',
      retired: 'core/1.9'
    })

    expect(run().status).toBe(0)

    expect(
      JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8'))
        .conditions.ref_name.include
    ).toEqual(['refs/heads/core/1.9'])
    expect(
      JSON.parse(readFileSync(join(directory, 'labels.json'), 'utf8'))
    ).toContain('core/1.58')
  })

  it('disables its freeze ruleset if no release lines remain retired', () => {
    const { directory, run } = reconciliation({
      active: 'core/1.9 core/1.59 core/1.60',
      retired: ''
    })

    expect(run().status).toBe(0)

    expect(
      JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8'))
        .enforcement
    ).toBe('disabled')
  })

  it.for([
    { name: 'dry run', options: { apply: false }, status: 0 },
    { name: 'failed freeze', options: { failFreeze: true }, status: 1 },
    { name: 'changed ComfyUI head', options: { stale: true }, status: 1 }
  ])('does not mutate labels after $name', ({ options, status }) => {
    const { directory, run } = reconciliation(options)

    expect(run().status).toBe(status)

    expect(readFileSync(join(directory, 'writes'), 'utf8')).toBe('')
    expect(
      JSON.parse(readFileSync(join(directory, 'labels.json'), 'utf8'))
    ).toContain('core/1.59')
  })
})
