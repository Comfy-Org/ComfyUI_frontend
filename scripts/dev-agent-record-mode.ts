import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import type { Options } from './dev-agent-options'
import {
  assertReachable,
  spawnGroup,
  supervise,
  wait,
  waitForHttp
} from './dev-agent-supervisor'

const execFileAsync = promisify(execFile)
// The ports the cloud repo's own local stack publishes.
const PG_PORT = 54331
const REDIS_PORT = 6379
const CLOUD_QUICKSTART =
  'start the cloud stack first: `cloud up` from the cloud checkout, or scripts/start-all.sh'
// Fixed so a rerun seeds nothing and the printed recorder command never moves.
const TEMPORAL_INSTALL =
  'brew install temporal, or: https://docs.temporal.io/cli#install'
const RECORD_USER_ID = 'rec-local-user'
const RECORD_WORKSPACE_ID = 'w-1f2e3d4c-5b6a-4798-8899-aabbccddeeff'

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
  service: string,
  image: string
): Promise<string> {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '--format',
    '{{.Names}} {{.Image}} {{.Ports}}'
  ])
  const names = stdout
    .split('\n')
    .map((line) => line.split(' '))
    .filter(
      ([, imageName, ...ports]) =>
        imageName?.includes(image) &&
        ports.join(' ').includes(`:${portNumber}->`)
    )
    .map(([name]) => name)
  if (names.length === 0) {
    throw new Error(`No ${image} container publishes ${service} ${portNumber}`)
  }
  if (names.length > 1) {
    throw new Error(
      `${names.join(', ')} all publish ${service} ${portNumber}; stop the ones this recording should not use`
    )
  }
  return names[0]
}

async function pgExecCommand(override: string): Promise<string> {
  if (override) return override
  const name = await containerFor(PG_PORT, 'Postgres', 'postgres')
  return `docker exec -i ${name} psql -U postgres -d postgres -At -c`
}

async function redisExecCommand(): Promise<string> {
  const name = await containerFor(REDIS_PORT, 'Redis', 'redis')
  return `docker exec -i ${name} redis-cli`
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
  const parsed: unknown = JSON.parse(await readFile(fixture, 'utf8'))
  const workflow =
    typeof parsed === 'object' && parsed !== null && 'workflow' in parsed
      ? (parsed as { workflow?: { catalog?: unknown } }).workflow
      : undefined
  if (!workflow?.catalog) {
    throw new Error(`${fixture} has no workflow.catalog`)
  }
  const path = resolve(dataDir, 'widget-catalog.json')
  await writeFile(path, JSON.stringify(workflow.catalog))
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

export async function runRecord(options: Options): Promise<number> {
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
  let catalogPath: string
  let pgExec: string
  let redisExec: string
  try {
    catalogPath = await writeCatalog(options.catalog, dataDir)
    pgExec = await pgExecCommand(options.pgExec)
    redisExec = await redisExecCommand()
    await seedIdentity(pgExec)
  } catch (error) {
    await rm(dataDir, { force: true, recursive: true })
    throw error
  }

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
    const listening = await Promise.race([
      waitForPort(options.temporalPort, 'Temporal', 60_000).then(() => true),
      supervisor.exitRequested.then(() => false)
    ])
    if (!listening) {
      throw new Error('Temporal exited before it started listening')
    }
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
      waitForHttp(
        agent,
        `${agentUrl}/health`,
        supervisor.requested,
        'Standalone agent'
      ).then(() => null),
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

AGENT_CLOUD_SHA=${cloudSha} AGENT_MODEL=<model> \\
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
