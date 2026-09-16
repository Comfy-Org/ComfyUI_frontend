import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, 'package-e2e-coverage.sh')

function coverage(sourcePrefix: string) {
  return Array.from(
    { length: 100 },
    (_, index) =>
      `SF:${sourcePrefix}/file ${index}.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\n`
  ).join('')
}

function coverageFixture() {
  const root = mkdtempSync(join(tmpdir(), 'e2e-coverage-'))
  const shards = join(root, 'shards')
  const output = join(root, 'coverage')
  const html = join(root, 'html')
  const bin = join(root, 'bin')
  const githubOutput = join(root, 'github-output')
  const summary = join(root, 'summary')
  mkdirSync(shards)
  mkdirSync(bin)

  writeFileSync(
    join(bin, 'lcov'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "--remove" ]]; then
  exit 0
fi
inputs=()
output=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a)
      inputs+=("$2")
      shift 2
      ;;
    -o)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
: > "$output"
for input in "\${inputs[@]}"; do
  cat "$input" >> "$output"
done
`,
    { mode: 0o755 }
  )
  writeFileSync(
    join(bin, 'genhtml'),
    `#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then
    mkdir -p "$2"
    touch "$2/index.html"
    exit 0
  fi
  shift
done
exit 1
`,
    { mode: 0o755 }
  )

  return {
    root,
    shards,
    output,
    html,
    githubOutput,
    summary,
    writeShard(name: string, contents: string) {
      const shard = join(shards, name)
      mkdirSync(shard, { recursive: true })
      writeFileSync(join(shard, 'coverage.lcov'), contents)
    },
    run() {
      const result = spawnSync('bash', [SCRIPT, shards, output, html], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          GITHUB_OUTPUT: githubOutput,
          GITHUB_STEP_SUMMARY: summary
        }
      })
      return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`
      }
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

describe('package-e2e-coverage.sh', () => {
  it('packages available coverage from a partial run with a whitespace path', () => {
    using fixture = coverageFixture()
    fixture.writeShard('failed shard 1', coverage('src'))

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=true\n'
    )
    expect(
      readFileSync(join(fixture.output, 'coverage.lcov'), 'utf8')
    ).toContain('SF:src/file 0.ts')
    expect(readFileSync(fixture.summary, 'utf8')).toContain('failed shard 1')
    expect(existsSync(join(fixture.html, 'index.html'))).toBe(true)
  })

  it('skips successfully when no shard artifacts exist', () => {
    using fixture = coverageFixture()

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=false\n'
    )
    expect(existsSync(join(fixture.output, 'coverage.lcov'))).toBe(false)
  })

  it('fails when coverage is not mapped to repository sources', () => {
    using fixture = coverageFixture()
    fixture.writeShard('served-bundle', coverage('assets'))

    const result = fixture.run()

    expect(result.status).toBe(1)
    expect(result.output).toContain('Only 0 files under src/ or packages/')
    expect(existsSync(join(fixture.html, 'index.html'))).toBe(false)
  })
})
