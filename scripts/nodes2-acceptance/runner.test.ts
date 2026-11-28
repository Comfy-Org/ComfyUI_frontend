import { execFile, spawn } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { promisify } from 'node:util'

import { describe, expect, it, onTestFinished } from 'vitest'

const execute = promisify(execFile)
const source = resolve(
  process.env.NODES2_RUNNER_SOURCE || 'scripts/nodes2-acceptance'
)
const scratch = resolve('.amp/in/orb-backup/runner-tests')

function fixture() {
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(`${scratch}/case-`)
  const scripts = `${root}/scripts/nodes2-acceptance`
  mkdirSync(scripts, { recursive: true })
  mkdirSync(`${root}/tools/devtools`, { recursive: true })
  mkdirSync(`${root}/bin`)
  mkdirSync(`${root}/build`)
  copyFileSync(`${source}/run.sh`, `${scripts}/run.sh`)
  copyFileSync(`${source}/serve.sh`, `${scripts}/serve.sh`)
  const env = {
    ...process.env,
    PATH: `${root}/bin:${process.env.PATH}`,
    COMFYUI_DIR: root,
    COMFYUI_PYTHON: '/usr/bin/python3',
    NODES2_ACCEPTANCE_BUILD: 'test',
    NODES2_ACCEPTANCE_WORK_DIR: `${root}/work`,
    NODES2_ACCEPTANCE_TEST_BUILD: `${root}/build`,
    NODES2_ACCEPTANCE_PROD_BUILD: `${root}/build`,
    NODES2_ACCEPTANCE_RUN: '',
    NODES2_ACCEPTANCE_VARIANT: '',
    NODES2_ACCEPTANCE_REPORT_DIR: '',
    FIXTURE: root
  }
  function script(path: string, body: string) {
    writeFileSync(path, `#!/usr/bin/env bash\nset -eu\n${body}\n`)
    chmodSync(path, 0o755)
  }
  script(`${root}/bin/date`, 'echo 2026-11-26_120000')
  script(
    `${root}/bin/pnpm`,
    `
if [[ "$*" == *setupPacks.ts* ]]; then
  mkdir -p "$FIXTURE/work/packs"
  echo fixture >"$FIXTURE/work/packs/packs.txt"
  exit 0
fi
project=""
for arg in "$@"; do
  [[ $arg != --project=* ]] || project="\${arg#--project=}"
done
printf '%s|%s|%s\\n' "$project" "$NODES2_ACCEPTANCE_RUN" "\${NODES2_ACCEPTANCE_REPORT_DIR:-}" >>"$FIXTURE/results"
echo '  1 passed'
[[ $project != "\${FAIL_PROJECT:-}" ]] || exit 7
`
  )
  return { root, scripts, env, script }
}

async function result(file: string, args: string[], env: NodeJS.ProcessEnv) {
  try {
    const output = await execute('bash', [file, ...args], {
      env,
      timeout: 10000
    })
    return { code: 0, ...output }
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error)) throw error
    return { code: error.code, stdout: '', stderr: error.message }
  }
}

function runnerFixture() {
  const f = fixture()
  f.script(
    `${f.scripts}/serve.sh`,
    'mkdir -p "$2"; echo 99999999 >"$2/server.pid"'
  )
  return f
}

describe('acceptance runner', () => {
  it.for([
    'nodes2-acceptance',
    'nodes2-acceptance-packs',
    'nodes2-acceptance-layout',
    'nodes2-acceptance-perf'
  ])('returns %s failure while collecting every project', async (project) => {
    const f = runnerFixture()
    const run = await result(`${f.scripts}/run.sh`, [], {
      ...f.env,
      NODES2_ACCEPTANCE_PROJECTS: 'inputs packs layout perf',
      FAIL_PROJECT: project
    })
    expect(run.code).toBe(7)
    const projects = readFileSync(`${f.root}/results`, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('|')[0])
    expect(projects).toHaveLength(4)
    expect(projects).toEqual(
      expect.arrayContaining([
        'nodes2-acceptance',
        'nodes2-acceptance-layout',
        'nodes2-acceptance-packs',
        'nodes2-acceptance-perf'
      ])
    )
  })

  it('allocates different implicit identities with a fixed timestamp', async () => {
    const f = runnerFixture()
    const env = { ...f.env, NODES2_ACCEPTANCE_PROJECTS: 'inputs' }
    expect((await result(`${f.scripts}/run.sh`, [], env)).code).toBe(0)
    expect((await result(`${f.scripts}/run.sh`, [], env)).code).toBe(0)
    const ids = readFileSync(`${f.root}/results`, 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.split('|')[1])
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((id) => id.startsWith('2026-11-26_120000-'))).toBe(true)
  })

  it('preserves explicit run and report overrides with a variant', async () => {
    const f = runnerFixture()
    const run = await result(`${f.scripts}/run.sh`, [], {
      ...f.env,
      NODES2_ACCEPTANCE_PROJECTS: 'inputs',
      NODES2_ACCEPTANCE_RUN: 'named-run',
      NODES2_ACCEPTANCE_VARIANT: 'candidate',
      NODES2_ACCEPTANCE_REPORT_DIR: `${f.root}/custom-report`
    })
    expect(run.code).toBe(0)
    expect(readFileSync(`${f.root}/results`, 'utf8')).toBe(
      `nodes2-acceptance|named-run|${f.root}/custom-report\n`
    )
    expect(
      existsSync(`${f.root}/custom-report/logs/nodes2-acceptance.log`)
    ).toBe(true)
  })
})

function startupFixture() {
  const f = fixture()
  f.script(
    `${f.root}/bin/python`,
    'echo $$ >"$FIXTURE/child.pid"; exec /bin/sleep 60'
  )
  f.script(`${f.root}/bin/sleep`, 'exit 0')
  f.script(`${f.root}/bin/lsof`, '[[ " $* " == *" -p "* ]]')
  f.script(`${f.root}/bin/curl`, '[[ " $* " != *" -fsS "* ]]')
  const backend = `${f.root}/backend`
  const env = { ...f.env, COMFYUI_PYTHON: `${f.root}/bin/python` }
  onTestFinished(() => {
    if (existsSync(`${f.root}/child.pid`)) {
      const pid = Number(readFileSync(`${f.root}/child.pid`, 'utf8'))
      try {
        process.kill(pid)
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !('code' in error) ||
          error.code !== 'ESRCH'
        )
          throw error
      }
    }
  })
  return { ...f, backend, env, args: ['18461', backend, `${f.root}/build`] }
}

describe('acceptance startup', () => {
  it('rejects HTTP errors and removes the failed child pidfile', async () => {
    const f = startupFixture()
    const run = await result(`${f.scripts}/serve.sh`, f.args, f.env)
    expect(run.code).toBe(1)
    expect(existsSync(`${f.backend}/server.pid`)).toBe(false)
    const pid = Number(readFileSync(`${f.root}/child.pid`, 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('rejects a healthy HTTP response when the child does not own the listener', async () => {
    const f = startupFixture()
    f.script(`${f.root}/bin/lsof`, 'exit 1')
    f.script(`${f.root}/bin/curl`, 'exit 0')
    expect((await result(`${f.scripts}/serve.sh`, f.args, f.env)).code).toBe(1)
    expect(existsSync(`${f.backend}/server.pid`)).toBe(false)
  })

  it('rejects an exited child despite a healthy HTTP response', async () => {
    const f = startupFixture()
    f.script(`${f.root}/bin/python`, 'echo $$ >"$FIXTURE/child.pid"; exit 7')
    f.script(`${f.root}/bin/curl`, 'exit 0')
    f.script(
      `${f.root}/bin/lsof`,
      '[[ " $* " == *" -p "* ]] || exit 1; while [[ ! -f "$FIXTURE/child.pid" ]]; do /bin/sleep .01; done; while kill -0 "$(cat "$FIXTURE/child.pid")" 2>/dev/null; do /bin/sleep .01; done'
    )
    expect((await result(`${f.scripts}/serve.sh`, f.args, f.env)).code).toBe(1)
  })

  it('cleans up its launched child when startup is interrupted', async () => {
    const f = startupFixture()
    f.script(
      `${f.root}/bin/lsof`,
      '[[ " $* " != *" -p "* ]] || { while [[ ! -f "$FIXTURE/child.pid" ]]; do /bin/sleep .01; done; kill -TERM "$PPID"; }; exit 1'
    )
    expect((await result(`${f.scripts}/serve.sh`, f.args, f.env)).code).toBe(
      143
    )
    expect(existsSync(`${f.backend}/server.pid`)).toBe(false)
    const pid = Number(readFileSync(`${f.root}/child.pid`, 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('interrupting the runner also cleans up an in-flight startup', async () => {
    const f = startupFixture()
    f.script(
      `${f.root}/bin/lsof`,
      '[[ " $* " != *" -p "* ]] || { while [[ ! -f "$FIXTURE/child.pid" ]]; do /bin/sleep .01; done; kill -TERM "$(ps -o ppid= -p "$PPID" | tr -d " ")"; }; exit 1'
    )
    const run = await result(`${f.scripts}/run.sh`, [], {
      ...f.env,
      NODES2_ACCEPTANCE_RUN: 'interrupted',
      NODES2_ACCEPTANCE_PROJECTS: 'inputs'
    })
    expect(run.code).toBe(143)
    expect(existsSync(`${f.root}/work/inputs/server.pid`)).toBe(false)
    const pid = Number(readFileSync(`${f.root}/child.pid`, 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('rejects an occupied port without disturbing the listener', async () => {
    const f = fixture()
    const server = createServer((_request, response) =>
      response.end('unrelated')
    )
    onTestFinished(
      () => new Promise<void>((resolve) => server.close(() => resolve()))
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Missing test listener')
    const run = await result(
      `${f.scripts}/serve.sh`,
      [String(address.port), `${f.root}/backend`, `${f.root}/build`],
      f.env
    )
    expect(run.code).toBe(1)
    expect(server.listening).toBe(true)
  })

  it('does not terminate an unrelated process named by a pidfile', async () => {
    const f = startupFixture()
    const unrelated = spawn('/bin/sleep', ['60'])
    onTestFinished(() => {
      unrelated.kill()
    })
    mkdirSync(f.backend)
    writeFileSync(`${f.backend}/server.pid`, String(unrelated.pid))
    f.script(`${f.root}/bin/curl`, 'exit 0')
    expect((await result(`${f.scripts}/serve.sh`, f.args, f.env)).code).toBe(1)
    expect(unrelated.kill(0)).toBe(true)
  })

  it('hands off a live child after successful owned-listener readiness', async () => {
    const f = startupFixture()
    f.script(`${f.root}/bin/curl`, 'exit 0')
    expect((await result(`${f.scripts}/serve.sh`, f.args, f.env)).code).toBe(0)
    const pid = Number(readFileSync(`${f.backend}/server.pid`, 'utf8'))
    expect(() => process.kill(pid, 0)).not.toThrow()
  })
})
