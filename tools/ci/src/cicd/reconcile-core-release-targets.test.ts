import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

function reconciliation({
  apply = true,
  existing = true,
  stale = false,
  retired = 'core/1.58 core/1.59'
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'core-retirement-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(
    join(directory, 'rulesets.json'),
    JSON.stringify([
      [
        { id: 7, name: 'Core release branches' },
        ...(existing ? [{ id: 9, name: 'Retired core release lines' }] : [])
      ]
    ])
  )
  writeFileSync(join(directory, 'writes'), '')
  writeFileSync(
    join(directory, 'git'),
    '#!/bin/sh\nprintf "%s\\trefs/heads/master\\n" "$LATEST_PIN"\n',
    { mode: 0o755 }
  )
  writeFileSync(
    join(directory, 'gh'),
    `#!/bin/bash
set -euo pipefail
case "$*" in
  'api repos/Comfy-Org/ComfyUI_frontend/rulesets --paginate --slurp')
    cat "$STATE/rulesets.json" ;;
  'api --method PUT repos/Comfy-Org/ComfyUI_frontend/rulesets/9 --input -' | \\
  'api --method POST repos/Comfy-Org/ComfyUI_frontend/rulesets --input -')
    cat > "$STATE/request.json"
    echo "$3 $4" >> "$STATE/writes" ;;
  *) echo "Unexpected GitHub request: $*" >&2; exit 2 ;;
esac
`,
    { mode: 0o755 }
  )

  const result = spawnSync(
    'bash',
    [
      '--noprofile',
      '--norc',
      'tools/ci/src/cicd/reconcile-core-release-targets.sh'
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        STATE: directory,
        GH_REPO: 'Comfy-Org/ComfyUI_frontend',
        ACTIVE_CORE_TARGETS: 'core/1.60 core/1.61',
        RETIRED_CORE_TARGETS: retired,
        COMFYUI_PIN_SHA: 'pin-sha',
        LATEST_PIN: stale ? 'changed-pin' : 'pin-sha',
        APPLY: String(apply)
      }
    }
  )
  return {
    directory,
    result,
    writes: readFileSync(join(directory, 'writes'), 'utf8')
  }
}

describe('core retirement reconciliation', () => {
  it('creates a separate freeze ruleset on the first run', () => {
    const { result, writes } = reconciliation({ existing: false })

    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(writes).toBe('POST repos/Comfy-Org/ComfyUI_frontend/rulesets\n')
  })

  it('updates only the retirement ruleset without touching labels', () => {
    const { directory, result, writes } = reconciliation()

    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(writes).toBe('PUT repos/Comfy-Org/ComfyUI_frontend/rulesets/9\n')
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
  })

  it('disables its freeze ruleset if no release lines remain retired', () => {
    const { directory, result } = reconciliation({ retired: '' })

    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(
      JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8'))
    ).toMatchObject({
      enforcement: 'disabled',
      conditions: { ref_name: { include: [] } }
    })
  })

  it.for([
    { name: 'dry run', options: { apply: false }, status: 0 },
    { name: 'changed ComfyUI head', options: { stale: true }, status: 1 }
  ])('does not change the ruleset on $name', ({ options, status }) => {
    const { result, writes } = reconciliation(options)

    expect(result).toMatchObject({ status, stderr: '' })
    expect(writes).toBe('')
  })
})
