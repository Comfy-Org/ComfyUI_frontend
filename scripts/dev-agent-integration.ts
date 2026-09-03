import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface Options {
  agentPort: number
  airBin: string
  cloudRepo: string
  comfyUrl: string
  frontendPort: number
  healthPort: number
  help: boolean
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const USAGE = `Usage: pnpm tsx scripts/dev-agent-integration.ts [options]

Options:
  --cloud-repo PATH     Comfy-Org/cloud checkout (default: ../cloud)
  --comfy-url URL       Local ComfyUI URL (default: http://127.0.0.1:8188)
  --frontend-port PORT  Vite port (default: 6207)
  --agent-port PORT     Standalone agent port (default: 6286)
  --air-bin PATH        Air executable (default: $AIR_BIN or ~/go/bin/air)
  --help                Show this help
`

function optionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (value === undefined) throw new Error(`${option} requires a value`)
  return value
}

function port(value: string, option: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${option} must be an integer from 1 to 65535`)
  }
  return parsed
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    agentPort: 6286,
    airBin: process.env.AIR_BIN ?? resolve(homedir(), 'go/bin/air'),
    cloudRepo: resolve(PROJECT_ROOT, '../cloud'),
    comfyUrl: 'http://127.0.0.1:8188',
    frontendPort: 6207,
    healthPort: 0,
    help: false
  }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    switch (arg) {
      case '--agent-port':
        options.agentPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--air-bin':
        options.airBin = resolve(optionValue(args, index, arg))
        index++
        break
      case '--cloud-repo':
        options.cloudRepo = resolve(optionValue(args, index, arg))
        index++
        break
      case '--comfy-url':
        options.comfyUrl = optionValue(args, index, arg)
        index++
        break
      case '--frontend-port':
        options.frontendPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--help':
        options.help = true
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }
  if (options.agentPort === options.frontendPort) {
    throw new Error('Agent and frontend ports must be different')
  }
  options.healthPort = options.agentPort + 1
  if (options.healthPort > 65535) {
    throw new Error(
      '--agent-port must leave room for the agent health port (agent port + 1)'
    )
  }
  if (options.healthPort === options.frontendPort) {
    throw new Error(
      `Agent health port ${options.healthPort} (agent port + 1) collides with the frontend port`
    )
  }
  return options
}

async function assertWorkspacePackage(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(PROJECT_ROOT, 'package.json'), 'utf8')
  ) as { dependencies?: Record<string, string> }
  const dependency = manifest.dependencies?.['@comfyorg/comfy-multi-player']
  if (dependency?.startsWith('link:')) {
    throw new Error(
      '@comfyorg/comfy-multi-player must not be pnpm linked; use the in-workspace package'
    )
  }
  if (!dependency?.startsWith('workspace:')) {
    console.warn(
      '[dev-agent-integration] @comfyorg/comfy-multi-player is the published package; edits to it will not hot-reload until it is an in-workspace dependency'
    )
  }
}

async function assertReachable(url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
}

function spawnGroup(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): ChildProcess {
  return spawn(command, args, {
    cwd,
    detached: process.platform !== 'win32',
    env,
    stdio: 'inherit'
  })
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function stopGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || hasExited(child)) return
  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch {
    child.kill(signal)
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs: number
): Promise<void> {
  if (hasExited(child)) return
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    wait(timeoutMs)
  ])
}

async function waitForAgent(
  child: ChildProcess,
  url: string,
  stopped: () => boolean
): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline && !stopped()) {
    if (hasExited(child)) {
      throw new Error(`Standalone agent exited with code ${child.exitCode}`)
    }
    try {
      await assertReachable(`${url}/health`)
      return
    } catch {
      await wait(500)
    }
  }
  if (stopped()) return
  throw new Error(`Standalone agent did not become ready at ${url}/health`)
}

function standaloneEnv(options: Options, dataDir: string, token: string) {
  const env = { ...process.env }
  for (const key of [
    'AGENT_M2M_SECRET',
    'AGENT_RUNNER_ENDPOINT',
    'DB_CONNECTION_STRING',
    'DOC_HOST_ENDPOINT',
    'REDIS_URL'
  ]) {
    delete env[key]
  }
  return {
    ...env,
    AGENT_BIND_ADDR: '127.0.0.1',
    AGENT_COMFY_URL: options.comfyUrl,
    AGENT_CRDT_MODE: 'off',
    AGENT_DATA_DIR: dataDir,
    AGENT_ENGINE: 'inline',
    AGENT_SESSION_TOKEN: token,
    AGENT_STANDALONE: 'true',
    AGENT_TARGET: 'local',
    HEALTH_PORT: String(options.healthPort),
    PORT: String(options.agentPort)
  }
}

async function run(options: Options): Promise<number> {
  await assertWorkspacePackage()
  await access(options.airBin, constants.X_OK)
  const agentDir = resolve(options.cloudRepo, 'services/agent')
  await access(resolve(agentDir, '.air.toml'))
  await assertReachable(`${options.comfyUrl.replace(/\/$/, '')}/system_stats`)
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_BASE_URL) {
    throw new Error('Set ANTHROPIC_API_KEY or ANTHROPIC_BASE_URL')
  }

  const dataDir = await mkdtemp(resolve(tmpdir(), 'comfy-agent-integration-'))
  const token = randomBytes(32).toString('hex')
  const agentUrl = `http://127.0.0.1:${options.agentPort}`
  const agent = spawnGroup(
    options.airBin,
    ['-c', '.air.toml'],
    agentDir,
    standaloneEnv(options, dataDir, token)
  )
  let frontend: ChildProcess | null = null
  let stopping = false
  let requestedExitCode: number | null = null
  let resolveExitRequest: (code: number) => void = () => {}
  const exitRequested = new Promise<number>((resolveExit) => {
    resolveExitRequest = resolveExit
  })
  const requestExit = (code: number) => {
    if (requestedExitCode !== null) return
    requestedExitCode = code
    resolveExitRequest(code)
  }
  const onSigint = () => requestExit(130)
  const onSigterm = () => requestExit(143)
  process.once('SIGINT', onSigint)
  process.once('SIGTERM', onSigterm)
  agent.once('exit', (code) => requestExit(code ?? 1))
  agent.once('error', () => requestExit(1))

  async function stop(exitCode: number): Promise<number> {
    if (stopping) return exitCode
    stopping = true
    if (frontend) stopGroup(frontend, 'SIGTERM')
    stopGroup(agent, 'SIGTERM')
    await Promise.all(
      [agent, frontend]
        .filter((child): child is ChildProcess => child !== null)
        .map((child) => waitForExit(child, 2000))
    )
    if (frontend && !hasExited(frontend)) stopGroup(frontend, 'SIGKILL')
    if (!hasExited(agent)) stopGroup(agent, 'SIGKILL')
    await Promise.all(
      [agent, frontend]
        .filter((child): child is ChildProcess => child !== null)
        .map((child) => waitForExit(child, 1000))
    )
    await rm(dataDir, { force: true, recursive: true })
    process.removeListener('SIGINT', onSigint)
    process.removeListener('SIGTERM', onSigterm)
    return exitCode
  }

  try {
    const startupResult = await Promise.race([
      waitForAgent(agent, agentUrl, () => requestedExitCode !== null).then(
        () => null
      ),
      exitRequested
    ])
    if (startupResult !== null) return await stop(startupResult)
    const frontendUrl = `http://127.0.0.1:${options.frontendPort}`
    frontend = spawnGroup(
      'pnpm',
      [
        'exec',
        'vite',
        '--config',
        'vite.config.mts',
        '--host',
        '127.0.0.1',
        '--port',
        String(options.frontendPort),
        '--strictPort'
      ],
      PROJECT_ROOT,
      {
        ...process.env,
        DEV_AGENT_SESSION_TOKEN: token,
        DEV_AGENT_URL: agentUrl,
        DEV_SERVER_COMFYUI_URL: options.comfyUrl,
        VITE_AGENT_STANDALONE: 'true'
      }
    )
    frontend.once('exit', (code) => requestExit(code ?? 1))
    frontend.once('error', () => requestExit(1))
    process.stdout.write(
      `\nAgent integration environment ready: ${frontendUrl}\n` +
        `Playwright: PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=${frontendUrl} pnpm exec playwright test browser_tests/tests/agent\n` +
        'Press Ctrl-C to stop the frontend and standalone agent.\n\n'
    )

    const exitCode = await exitRequested
    return await stop(exitCode)
  } catch (error) {
    await stop(1)
    throw error
  }
}

async function main(): Promise<void> {
  try {
    const options = parseOptions(process.argv.slice(2))
    if (options.help) {
      process.stdout.write(USAGE)
      return
    }
    process.exitCode = await run(options)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

void main()
