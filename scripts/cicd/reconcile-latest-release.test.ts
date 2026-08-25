import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'reconcile-latest-release.sh')

type Release = {
  tagName: string
  isDraft?: boolean
  isPrerelease?: boolean
  isLatest?: boolean
}

// Drives the real script with `gh` stubbed on PATH, so the semver-selection and
// reassignment logic runs for real without touching the network or a live repo.
function runReconcile(
  releases: Release[],
  options: { repo?: string | null } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-latest-'))
  const binDir = path.join(dir, 'bin')
  fs.mkdirSync(binDir)
  const editLog = path.join(dir, 'edits.log')

  const releasesJson = JSON.stringify(
    releases.map((r) => ({
      tagName: r.tagName,
      isDraft: r.isDraft ?? false,
      isPrerelease: r.isPrerelease ?? false,
      isLatest: r.isLatest ?? false
    }))
  )

  // Minimal `gh` shim: serve the release list, record `release edit --latest`.
  const ghStub = [
    '#!/usr/bin/env bash',
    'if [[ "$1" == "release" && "$2" == "list" ]]; then',
    '  printf %s "$STUB_RELEASES_JSON"',
    '  exit 0',
    'fi',
    'if [[ "$1" == "release" && "$2" == "edit" ]]; then',
    '  printf "%s\\n" "$*" >> "$STUB_EDIT_LOG"',
    '  exit 0',
    'fi',
    'echo "unexpected gh invocation: $*" >&2',
    'exit 99',
    ''
  ].join('\n')
  fs.writeFileSync(path.join(binDir, 'gh'), ghStub, { mode: 0o755 })

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
    STUB_RELEASES_JSON: releasesJson,
    STUB_EDIT_LOG: editLog,
    GITHUB_STEP_SUMMARY: ''
  }
  if (options.repo === null) {
    delete env.REPO
  } else {
    env.REPO = options.repo ?? 'Comfy-Org/ComfyUI_frontend'
  }

  const result = spawnSync('bash', [SCRIPT], {
    cwd: dir,
    encoding: 'utf8',
    env
  })

  const edits = fs.existsSync(editLog)
    ? fs
        .readFileSync(editLog, 'utf8')
        .split('\n')
        .filter((line) => line.length > 0)
    : []

  fs.rmSync(dir, { recursive: true, force: true })
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    edits
  }
}

describe('reconcile-latest-release.sh', () => {
  it('reassigns latest to the highest stable semver when it lags', () => {
    const { status, edits } = runReconcile([
      { tagName: 'v1.47.9', isLatest: true },
      { tagName: 'v1.48.0' }
    ])

    expect(status).toBe(0)
    expect(edits).toEqual([
      'release edit v1.48.0 --repo Comfy-Org/ComfyUI_frontend --latest'
    ])
  })

  it('is a no-op when latest already matches the highest release', () => {
    const { status, output, edits } = runReconcile([
      { tagName: 'v1.47.9' },
      { tagName: 'v1.48.0', isLatest: true }
    ])

    expect(status).toBe(0)
    expect(edits).toEqual([])
    expect(output).toContain('already matches')
  })

  it('orders versions numerically, not lexically (v1.47.10 > v1.47.9)', () => {
    // A plain string sort would pick v1.47.9; sort -V must win here.
    const { status, edits } = runReconcile([
      { tagName: 'v1.47.9', isLatest: true },
      { tagName: 'v1.47.10' }
    ])

    expect(status).toBe(0)
    expect(edits).toEqual([
      'release edit v1.47.10 --repo Comfy-Org/ComfyUI_frontend --latest'
    ])
  })

  it('ignores drafts, prereleases, and other packages’ tags', () => {
    const { status, edits } = runReconcile([
      { tagName: 'v1.48.0', isLatest: true },
      { tagName: 'v2.0.0', isDraft: true },
      { tagName: 'v1.49.0-rc.1', isPrerelease: true },
      { tagName: 'design-system@3.1.0' },
      { tagName: 'desktop-ui@1.0.0' },
      { tagName: '1.99.0' },
      { tagName: 'v1.48.1' }
    ])

    expect(status).toBe(0)
    // Highest *stable frontend* semver is v1.48.1, not the draft v2.0.0.
    expect(edits).toEqual([
      'release edit v1.48.1 --repo Comfy-Org/ComfyUI_frontend --latest'
    ])
  })

  it('exits cleanly with a warning when no stable semver release exists', () => {
    const { status, output, edits } = runReconcile([
      { tagName: 'v2.0.0', isDraft: true },
      { tagName: 'design-system@3.1.0' }
    ])

    expect(status).toBe(0)
    expect(edits).toEqual([])
    expect(output).toContain('No stable semver releases found')
  })

  it('exits non-zero with a clear error when REPO is unset', () => {
    const { status, output, edits } = runReconcile([{ tagName: 'v1.48.0' }], {
      repo: null
    })

    expect(status).not.toBe(0)
    expect(output).toContain('REPO is required')
    expect(edits).toEqual([])
  })
})
