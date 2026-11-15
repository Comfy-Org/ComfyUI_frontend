import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
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

const image = 'ghcr.io/comfy-org/comfyui-ci-container'
const digest = `sha256:${'1'.repeat(64)}`
const sourceTag = 'refs/tags/ci-container/v0.0.28'

function fixture(version = '0.0.28') {
  const root = mkdtempSync(join(tmpdir(), 'container-publish-'))
  const repo = join(root, 'repo')
  const remote = join(root, 'remote.git')
  const bin = join(root, 'bin')
  const state = join(root, 'state')
  mkdirSync(join(repo, 'tools/ci-container'), { recursive: true })
  mkdirSync(bin)
  mkdirSync(state)
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim()
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  git('config', 'core.hooksPath', '/dev/null')
  git('config', 'commit.gpgSign', 'false')
  git('config', 'tag.gpgSign', 'false')
  git('init', '--bare', remote)
  git('remote', 'add', 'origin', remote)
  cpSync(
    join(import.meta.dirname, 'publish.sh'),
    join(repo, 'tools/ci-container/publish.sh')
  )
  writeFileSync(join(repo, 'tools/ci-container/VERSION'), version)
  writeFileSync(
    join(repo, 'tools/ci-container/Dockerfile'),
    'ARG COMFYUI_VERSION=v0.30.0\nFROM mcr.microsoft.com/playwright:v1.63.0-noble\n'
  )
  writeFileSync(
    join(repo, 'tools/ci-container/validate.sh'),
    'test "${FAIL_POINT:-}" != validate\n'
  )
  git('add', '.')
  git('commit', '-m', 'fixture')
  git('push', 'origin', 'main')
  const revision = git('rev-parse', 'HEAD')
  writeFileSync(
    join(state, 'versions.json'),
    JSON.stringify([
      [{ name: 'old', metadata: { container: { tags: ['0.0.27'] } } }]
    ])
  )
  writeFileSync(join(state, 'aliases.json'), '{}')
  writeFileSync(join(state, 'builds'), '0')
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *'/runs?'*) printf '[{"workflow_runs":[{"status":"%s"}]}]' "\${OLD_RUN:-completed}" ;;
  *'--jq .state') echo "\${OLD_STATE:-disabled_manually}" ;;
  *'/versions?'*)
    test "\${FAIL_POINT:-}" != registry
    cat "$STATE/versions.json" ;;
  *) exit 90 ;;
esac
`,
    { mode: 0o755 }
  )
  writeFileSync(
    join(bin, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${!#}" == *'/token?'* ]]; then
  test "\${FAIL_POINT:-}" != token
  echo '{"token":"test"}'
  exit
fi
while (( $# )); do
  if [[ "$1" == --dump-header ]]; then
    printf 'Docker-Content-Digest: %s\r\n' "$DIGEST" > "$2"
    shift
  fi
  shift
done
if [[ -n "\${REGISTRY_STATUS:-}" ]]; then
  echo "$REGISTRY_STATUS"
elif [[ -f "$STATE/image.json" ]]; then
  echo 200
else
  echo 404
fi
`,
    { mode: 0o755 }
  )
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  build)
    echo "$(( $(cat "$STATE/builds") + 1 ))" > "$STATE/builds"
    labels='{}'
    while (( $# )); do
      if [[ "$1" == --label ]]; then
        labels=$(jq --arg key "\${2%%=*}" --arg value "\${2#*=}" '. + {($key): $value}' <<< "$labels")
        shift
      fi
      shift
    done
    jq -n --argjson labels "$labels" '[{Os: "linux", Architecture: "amd64", Config: {Labels: $labels}}]' > "$STATE/local.json" ;;
  push)
    cp "$STATE/local.json" "$STATE/image.json"
    test "\${FAIL_POINT:-}" != push ;;
  pull) test "\${FAIL_POINT:-}" != pull ;;
  image) cat "$STATE/image.json" ;;
  buildx)
    jq --arg alias "\${6##*:}" --arg digest "\${7#*@}" '. + {($alias): $digest}' "$STATE/aliases.json" > "$STATE/next.json"
    mv "$STATE/next.json" "$STATE/aliases.json"
    test "\${FAIL_POINT:-}" != alias ;;
  *) exit 91 ;;
esac
`,
    { mode: 0o755 }
  )
  return {
    git,
    revision,
    state,
    run(env: NodeJS.ProcessEnv = {}) {
      return spawnSync('bash', ['tools/ci-container/publish.sh'], {
        cwd: repo,
        encoding: 'utf8',
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          HOME: root,
          STATE: state,
          DIGEST: digest,
          GH_TOKEN: 'test',
          GITHUB_ACTOR: 'test',
          ...env
        }
      })
    },
    tags() {
      return git('ls-remote', '--tags', 'origin')
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

describe('CI container publication', () => {
  it.for([
    ['', 0],
    ['push', 1],
    ['pull', 1],
    ['alias', 1]
  ] satisfies [string, number][])(
    'converges after interruption at %s even with stale package metadata',
    ([failure, status]) => {
      using release = fixture()
      const interrupted = release.run({ FAIL_POINT: failure })
      expect(interrupted).toMatchObject({ status })

      const recovered = release.run()
      expect(recovered).toMatchObject({ status: 0 })
      expect(readFileSync(join(release.state, 'builds'), 'utf8').trim()).toBe(
        '1'
      )
      expect(
        JSON.parse(readFileSync(join(release.state, 'aliases.json'), 'utf8'))
      ).toEqual({
        main: digest,
        latest: digest,
        '0': digest,
        '0.0': digest,
        'comfyui-v0.30.0': digest,
        'playwright-v1.63.0': digest
      })
      expect(
        release.git('for-each-ref', '--format=%(contents)', sourceTag)
      ).toBe(`${image}@${digest}`)
      expect(release.tags()).toContain(`${release.revision}\t${sourceTag}^{}`)
    }
  )

  it.for([
    { OLD_STATE: 'active' },
    { OLD_RUN: 'in_progress' },
    { FAIL_POINT: 'registry' },
    { FAIL_POINT: 'token' },
    { REGISTRY_STATUS: '503' },
    { FAIL_POINT: 'validate' }
  ] satisfies Record<string, string>[])(
    'does not publish when preconditions or candidate validation fail: %j',
    (env) => {
      using release = fixture()
      expect(release.run(env).status).not.toBe(0)
      expect(release.tags()).toBe('')
      expect(existsSync(join(release.state, 'image.json'))).toBe(false)
    }
  )

  it.for(['0.0.26', '00.0.28', '0.0.28-rc.1'])(
    'rejects older or noncanonical version %s',
    (version) => {
      using release = fixture(version)
      expect(release.run().status).not.toBe(0)
      expect(readFileSync(join(release.state, 'builds'), 'utf8')).toBe('0')
    }
  )

  it('does not claim an existing version from another source revision', () => {
    using release = fixture()
    expect(release.run({ FAIL_POINT: 'push' }).status).toBe(1)
    release.git('commit', '--allow-empty', '-m', 'later main commit')
    release.git('push', 'origin', 'main')

    const result = release.run()
    expect(result.stderr).toContain(
      'Published image does not match the release source'
    )
    expect(result.status).not.toBe(0)
    expect(release.tags()).toBe('')
    expect(readFileSync(join(release.state, 'builds'), 'utf8').trim()).toBe('1')
  })

  it('rejects a commit outside main before building', () => {
    using release = fixture()
    release.git('checkout', '-b', 'unreviewed')
    release.git('commit', '--allow-empty', '-m', 'unreviewed')

    expect(release.run().status).not.toBe(0)
    expect(readFileSync(join(release.state, 'builds'), 'utf8')).toBe('0')
  })

  it('does not rewind aliases when a newer source tag precedes package metadata', () => {
    using release = fixture()
    release.git('tag', 'ci-container/v0.0.29')
    release.git('push', 'origin', 'refs/tags/ci-container/v0.0.29')

    const result = release.run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Refusing to release an older version')
    expect(readFileSync(join(release.state, 'builds'), 'utf8')).toBe('0')
  })

  it('does not rebuild an image missing from an already tagged release', () => {
    using release = fixture()
    release.git(
      'tag',
      '-a',
      sourceTag.replace('refs/tags/', ''),
      '-m',
      `${image}@${digest}`
    )
    release.git('push', 'origin', sourceTag)

    const result = release.run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'Source tag exists but its image is missing'
    )
    expect(readFileSync(join(release.state, 'builds'), 'utf8')).toBe('0')
  })
})
