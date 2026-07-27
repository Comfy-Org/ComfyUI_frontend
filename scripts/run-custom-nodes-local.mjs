// One-command local runs of the custom-node suite.
//
//   pnpm test:custom-nodes:local        -> core  (local backend + dev server)
//   pnpm test:custom-nodes:local:cloud  -> cloud (built dist + preview -> testcloud)
//
// Boots whatever is not already running, waits on real readiness endpoints,
// runs the suite in the foreground, and tears down only the processes it
// started. Extra args pass through to Playwright (e.g. -- -g "ComfyUI-KJNodes").
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { config as dotenvConfig } from 'dotenv'

dotenvConfig()

const mode = process.argv[2]
const passthrough = process.argv.slice(3)
if (mode !== 'core' && mode !== 'cloud') {
  console.error('usage: run-custom-nodes-local.mjs <core|cloud> [playwright args]')
  process.exit(2)
}

const owned = []
function launch(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    ...options
  })
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[local-suite] ${name} exited early (code ${code})`)
      process.exit(1)
    }
  })
  owned.push({ name, child })
  return child
}

let shuttingDown = false
function shutdown() {
  shuttingDown = true
  for (const { child } of owned.reverse()) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
}
process.on('SIGINT', () => {
  shutdown()
  process.exit(130)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(143)
})

async function isUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return res.status < 500
  } catch {
    return false
  }
}

async function waitFor(name, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isUp(url)) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`${name} not ready at ${url} within ${timeoutMs / 1000}s`)
}

function runForeground(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

async function core() {
  const backendUrl = 'http://127.0.0.1:8288'
  if (!(await isUp(`${backendUrl}/system_stats`))) {
    const dir = process.env.TEST_COMFYUI_DIR
    if (!dir || !existsSync(join(dir, 'main.py')))
      throw new Error(
        'no backend on :8288 and TEST_COMFYUI_DIR does not point at a ' +
          'ComfyUI checkout. One-time setup (packs + devtools installed) is ' +
          'in browser_tests/tests/customNodes/README.md Prerequisites.'
      )
    const venvPython = ['venv/bin/python', '.venv/bin/python']
      .map((p) => join(dir, p))
      .find(existsSync)
    const video = 'browser_tests/assets/plain_video.mp4'
    if (existsSync(video)) copyFileSync(video, join(dir, 'input', 'plain_video.mp4'))
    launch('backend', venvPython ?? 'python3', [
      'main.py',
      '--port',
      '8288',
      '--multi-user',
      '--cache-none'
    ], { cwd: dir })
    console.log('[local-suite] waiting for the backend on :8288 ...')
    await waitFor('backend', `${backendUrl}/system_stats`, 120_000)
  } else {
    console.log('[local-suite] reusing the backend already on :8288')
  }

  const devUrl = 'http://localhost:5173'
  if (!(await isUp(devUrl))) {
    launch('dev server', 'pnpm', ['dev'], {
      env: { ...process.env, DEV_SERVER_COMFYUI_URL: backendUrl }
    })
    console.log('[local-suite] waiting for the dev server on :5173 ...')
    await waitFor('dev server', devUrl, 90_000)
  } else {
    console.log('[local-suite] reusing the dev server already on :5173')
  }

  return runForeground('pnpm', ['test:custom-nodes', ...passthrough])
}

async function cloud() {
  for (const name of ['SMOKE_ACCOUNT_EMAIL', 'SMOKE_ACCOUNT_PASSWORD'])
    if (!process.env[name])
      throw new Error(
        `${name} is not set. Put both smoke credentials in the gitignored ` +
          '.env (1Password: Cloud Infra vault, "smoke-test@comfy.org ' +
          '(CI smoke account)").'
      )
  console.warn(
    '[local-suite] WARNING: this drives the ONE shared Cloud test instance. ' +
      'Do not run while a CI cloud run is in flight - overlapping runs ' +
      'corrupt each other.'
  )

  if (!passthrough.includes('--skip-build')) {
    const buildCode = await runForeground('pnpm', ['build:cloud-e2e'])
    if (buildCode !== 0) return buildCode
  }
  const args = passthrough.filter((arg) => arg !== '--skip-build')

  const previewUrl = 'http://localhost:4173'
  if (!(await isUp(previewUrl))) {
    launch('preview', 'pnpm', ['preview:cloud-e2e'])
    console.log('[local-suite] waiting for the preview on :4173 ...')
    await waitFor('preview', previewUrl, 60_000)
  } else {
    console.log('[local-suite] reusing the preview already on :4173')
  }

  return runForeground(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      'browser_tests/tests/customNodes/',
      '--project=custom-nodes',
      '--workers=1',
      ...args
    ],
    { CUSTOM_NODES_ENV: 'cloud', PLAYWRIGHT_TEST_URL: previewUrl }
  )
}

try {
  const exitCode = await (mode === 'core' ? core() : cloud())
  shutdown()
  process.exit(exitCode)
} catch (error) {
  console.error(`[local-suite] ${error instanceof Error ? error.message : error}`)
  shutdown()
  process.exit(1)
}
