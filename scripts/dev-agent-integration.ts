import { execFile, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

interface Options {
  agentPort: number
  airBin: string
  catalog: string
  cloudRepo: string
  comfyUrl: string
  docHostPort: number
  engine: string
  frontendPort: number
  healthPort: number
  help: boolean
  pgExec: string
  record: boolean
  temporalPort: number
  temporalUiPort: number
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const execFileAsync = promisify(execFile)
// The ports the cloud repo's own local stack publishes.
const PG_PORT = 54331
const REDIS_PORT = 6379
const CLOUD_QUICKSTART =
  'start the cloud stack first: `cloud up` from the cloud checkout, or scripts/start-all.sh'
// Fixed so a rerun seeds nothing and the printed recorder command never moves.
const TEMPORAL_INSTALL =
  'brew install temporal, or: https://docs.temporal.io/cli#install'
// The cloud's own dev server pairs the gRPC port with a UI port 1000 above it.
const TEMPORAL_UI_OFFSET = 1000
const RECORD_USER_ID = 'rec-local-user'
const RECORD_WORKSPACE_ID = 'w-1f2e3d4c-5b6a-4798-8899-aabbccddeeff'
const USAGE = `Usage: pnpm tsx scripts/dev-agent-integration.ts [options]

Options:
  --cloud-repo PATH     Comfy-Org/cloud checkout (default: ../cloud)
  --comfy-url URL       Local ComfyUI URL (default: http://127.0.0.1:8188)
  --frontend-port PORT  Vite port (default: 6207)
  --agent-port PORT     Standalone agent port (default: 6286)
  --air-bin PATH        Air executable (default: $AIR_BIN or ~/go/bin/air)
  --record              Record mode: the cloud stack's agent plus the doc host
  --catalog PATH        Conversation fixture whose workflow.catalog the agent loads
  --doc-host-port PORT  Doc host port in record mode (default: 8095)
  --pg-exec CMD         Command taking one SQL string, ending in -c
  --engine NAME         Record mode engine: inline or temporal (default: inline)
  --temporal-port PORT  Temporal gRPC port for --engine temporal (default: 7233)
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
    catalog: '',
    cloudRepo: resolve(PROJECT_ROOT, '../cloud'),
    comfyUrl: 'http://127.0.0.1:8188',
    docHostPort: 8095,
    engine: 'inline',
    frontendPort: 6207,
    healthPort: 0,
    help: false,
    pgExec: '',
    record: false,
    temporalPort: 7233,
    temporalUiPort: 0
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
      case '--catalog':
        options.catalog = resolve(optionValue(args, index, arg))
        index++
        break
      case '--doc-host-port':
        options.docHostPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--engine':
        options.engine = optionValue(args, index, arg)
        index++
        break
      case '--temporal-port':
        options.temporalPort = port(optionValue(args, index, arg), arg)
        index++
        break
      case '--pg-exec':
        options.pgExec = optionValue(args, index, arg)
        index++
        break
      case '--record':
        options.record = true
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
  if (options.record && !options.catalog) {
    throw new Error('--record requires --catalog <conversation fixture>')
  }
  if (options.engine !== 'inline' && options.engine !== 'temporal') {
    throw new Error('--engine must be inline or temporal')
  }
  if (options.engine === 'temporal' && !options.record) {
    throw new Error('--engine temporal applies to --record only')
  }
  options.temporalUiPort = options.temporalPort + TEMPORAL_UI_OFFSET
  if (options.temporalUiPort > 65535) {
    throw new Error(
      `--temporal-port must leave room for the Temporal UI port (port + ${TEMPORAL_UI_OFFSET})`
    )
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

// Neither Postgres nor Redis speaks HTTP, so a TCP connect is the whole check.
function assertListening(portNumber: number, label: string): Promise<void> {
  return new Promise((resolveCheck, rejectCheck) => {
    const socket = createConnection({ host: '127.0.0.1', port: portNumber })
    const fail = () => {
      socket.destroy()
      rejectCheck(
        new Error(
          `${label} is not listening on ${portNumber}; ${CLOUD_QUICKSTART}`
        )
      )
    }
    socket.setTimeout(3000)
    socket.once('connect', () => {
      socket.end()
      resolveCheck()
    })
    socket.once('timeout', fail)
    socket.once('error', fail)
  })
}

// Polls because the Temporal dev server binds a second or two after it starts.
async function waitForPort(
  portNumber: number,
  label: string,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return await assertListening(portNumber, label)
    } catch (error) {
      if (Date.now() >= deadline) throw error
      await wait(500)
    }
  }
}

async function assertTemporalCli(): Promise<void> {
  try {
    await execFileAsync('temporal', ['--version'])
  } catch {
    throw new Error(`temporal is not on PATH; ${TEMPORAL_INSTALL}`)
  }
}

// Neither psql nor redis-cli is on PATH here, so each service is reached through its container.
async function containerFor(
  portNumber: number,
  service: string
): Promise<string> {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '--format',
    '{{.Names}} {{.Ports}}'
  ])
  const name = stdout
    .split('\n')
    .find((line) => line.includes(`:${portNumber}->`))
    ?.split(' ')[0]
  if (!name) {
    throw new Error(`No container publishes ${service} ${portNumber}`)
  }
  return name
}

async function pgExecCommand(override: string): Promise<string> {
  if (override) return override
  const name = await containerFor(PG_PORT, 'Postgres')
  return `docker exec -i ${name} psql -U postgres -d postgres -At -c`
}

async function redisExecCommand(): Promise<string> {
  return `docker exec -i ${await containerFor(REDIS_PORT, 'Redis')} redis-cli`
}

// Every value is a module constant, so the statement carries no caller input.
async function seedIdentity(command: string): Promise<void> {
  const parts = command.split(' ').filter(Boolean)
  const sql = [
    `insert into users (id, create_time, update_time, email, name) values ('${RECORD_USER_ID}', now(), now(), 'recorder@local', 'recorder') on conflict (id) do nothing;`,
    `insert into workspaces (id, create_time, update_time, name, created_by_user_id) values ('${RECORD_WORKSPACE_ID}', now(), now(), 'recorder', '${RECORD_USER_ID}') on conflict (id) do nothing;`,
    `insert into workspace_memberships (id, create_time, update_time, role, user_id, workspace_id) values ('${RECORD_WORKSPACE_ID}:${RECORD_USER_ID}', now(), now(), 'owner', '${RECORD_USER_ID}', '${RECORD_WORKSPACE_ID}') on conflict (workspace_id, user_id) do nothing;`
  ].join(' ')
  await execFileAsync(parts[0], [...parts.slice(1), sql])
}

// AGENT_CRDT_MODE=on fails closed without a catalog; the doc host takes its own per request.
async function writeCatalog(fixture: string, dataDir: string): Promise<string> {
  const parsed = JSON.parse(await readFile(fixture, 'utf8')) as {
    workflow?: { catalog?: unknown }
  }
  if (!parsed.workflow?.catalog) {
    throw new Error(`${fixture} has no workflow.catalog`)
  }
  const path = resolve(dataDir, 'widget-catalog.json')
  await writeFile(path, JSON.stringify(parsed.workflow.catalog))
  return path
}

function recordEnv(options: Options, catalogPath: string, secret: string) {
  return {
    ...process.env,
    AGENT_COMFY_URL: options.comfyUrl,
    AGENT_CRDT_MODE: 'on',
    AGENT_ENGINE: options.engine,
    AGENT_M2M_SECRET: secret,
    AGENT_PORT: String(options.agentPort),
    // Without this the non-standalone default is cloud, and comfy-cli edits 401 against cloud.comfy.org.
    AGENT_TARGET: 'local',
    AGENT_WIDGET_CATALOG_PATH: catalogPath,
    DB_CONNECTION_STRING: `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable`,
    DOC_HOST_ENDPOINT: `http://127.0.0.1:${options.docHostPort}`,
    HEALTH_PORT: String(options.healthPort),
    REDIS_URL: `redis://localhost:${REDIS_PORT}/1`,
    // AGENT_TASK_QUEUE stays at its default so the agent's own worker serves it.
    ...(options.engine === 'temporal'
      ? {
          TEMPORAL_ADDRESS: `127.0.0.1:${options.temporalPort}`,
          TEMPORAL_NAMESPACE: 'default'
        }
      : {})
  }
}

// One lifecycle for a spawned group: the first exit reason wins and teardown runs once.
function supervise(dataDir: string) {
  const children: ChildProcess[] = []
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
  return {
    exitRequested,
    requested: () => requestedExitCode !== null,
    // Signalled newest first, so a dependent stops before what it was talking to.
    stop: async (exitCode: number): Promise<number> => {
      if (stopping) return exitCode
      stopping = true
      const newestFirst = [...children].reverse()
      for (const child of newestFirst) stopGroup(child, 'SIGTERM')
      await Promise.all(newestFirst.map((child) => waitForExit(child, 2000)))
      for (const child of newestFirst) {
        if (!hasExited(child)) stopGroup(child, 'SIGKILL')
      }
      await Promise.all(newestFirst.map((child) => waitForExit(child, 1000)))
      await rm(dataDir, { force: true, recursive: true })
      process.removeListener('SIGINT', onSigint)
      process.removeListener('SIGTERM', onSigterm)
      return exitCode
    },
    watch: (child: ChildProcess) => {
      children.push(child)
      child.once('exit', (code) => requestExit(code ?? 1))
      child.once('error', () => requestExit(1))
    }
  }
}

async function runRecord(options: Options): Promise<number> {
  const agentDir = resolve(options.cloudRepo, 'services/agent')
  await access(resolve(agentDir, 'start.sh'))
  await access(resolve(agentDir, 'dochost/start.sh'))
  await assertListening(PG_PORT, 'Postgres')
  await assertListening(REDIS_PORT, 'Redis')
  if (options.engine === 'temporal') await assertTemporalCli()
  await assertReachable(`${options.comfyUrl.replace(/\/$/, '')}/system_stats`)
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_BASE_URL) {
    throw new Error('Set ANTHROPIC_API_KEY or ANTHROPIC_BASE_URL')
  }

  const dataDir = await mkdtemp(resolve(tmpdir(), 'comfy-agent-record-'))
  const secretPath = resolve(dataDir, 'm2m.secret')
  const secret = randomBytes(32).toString('hex')
  await writeFile(secretPath, secret, { mode: 0o600 })
  const catalogPath = await writeCatalog(options.catalog, dataDir)
  const pgExec = await pgExecCommand(options.pgExec)
  const redisExec = await redisExecCommand()
  await seedIdentity(pgExec)

  const agentUrl = `http://127.0.0.1:${options.agentPort}`
  const supervisor = supervise(dataDir)
  if (options.engine === 'temporal') {
    supervisor.watch(
      spawnGroup(
        'temporal',
        [
          'server',
          'start-dev',
          '--ip',
          '127.0.0.1',
          '--port',
          String(options.temporalPort),
          '--ui-port',
          String(options.temporalUiPort)
        ],
        agentDir,
        process.env
      )
    )
    await waitForPort(options.temporalPort, 'Temporal', 60_000)
  }
  const docHost = spawnGroup('bash', ['dochost/start.sh'], agentDir, {
    ...process.env,
    DOC_HOST_PORT: String(options.docHostPort)
  })
  const agent = spawnGroup(
    'bash',
    ['start.sh'],
    agentDir,
    recordEnv(options, catalogPath, secret)
  )
  supervisor.watch(docHost)
  supervisor.watch(agent)

  try {
    const startupResult = await Promise.race([
      waitForAgent(agent, agentUrl, supervisor.requested).then(() => null),
      supervisor.exitRequested
    ])
    if (startupResult !== null) return await supervisor.stop(startupResult)
    const cloudSha = (
      await execFileAsync('git', ['-C', options.cloudRepo, 'rev-parse', 'HEAD'])
    ).stdout.trim()
    process.stdout.write(
      `
Recording stack ready: agent ${agentUrl}, doc host http://127.0.0.1:${options.docHostPort}
Record a case with:

AGENT_CLOUD_SHA=${cloudSha} AGENT_MODEL="$AGENT_MODEL" \\
AGENT_M2M_SECRET_FILE=${secretPath} AGENT_FULLSTACK_URL=${agentUrl} \\
AGENT_WORKSPACE_ID=${RECORD_WORKSPACE_ID} AGENT_USER_ID=${RECORD_USER_ID} \\
AGENT_PG_EXEC="${pgExec}" \\
AGENT_REDIS_EXEC="${redisExec}" \\
pnpm exec tsx scripts/agentConversationRecord.ts \\
  agent-rec-<slug> <seedFixture.json> --prompt "<prompt>" \\
  --out browser_tests/fixtures/data/agent/conversations/agent-rec-<slug>.json

Press Ctrl-C to stop the agent and doc host.

`
    )
    return await supervisor.stop(await supervisor.exitRequested)
  } catch (error) {
    await supervisor.stop(1)
    throw error
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
  const supervisor = supervise(dataDir)
  supervisor.watch(agent)

  try {
    const startupResult = await Promise.race([
      waitForAgent(agent, agentUrl, supervisor.requested).then(() => null),
      supervisor.exitRequested
    ])
    if (startupResult !== null) return await supervisor.stop(startupResult)
    const frontendUrl = `http://127.0.0.1:${options.frontendPort}`
    const frontend = spawnGroup(
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
    supervisor.watch(frontend)
    process.stdout.write(
      `\nAgent integration environment ready: ${frontendUrl}\n` +
        `Playwright: PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=${frontendUrl} pnpm exec playwright test browser_tests/tests/agent\n` +
        'Press Ctrl-C to stop the frontend and standalone agent.\n\n'
    )

    const exitCode = await supervisor.exitRequested
    return await supervisor.stop(exitCode)
  } catch (error) {
    await supervisor.stop(1)
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
    process.exitCode = options.record
      ? await runRecord(options)
      : await run(options)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

void main()
