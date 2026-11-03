import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import { splitCommandLine } from './dev-agent-options'
import type { Options } from './dev-agent-options'
import { preflightAgent } from './dev-agent-preflight'
import {
  assertFree,
  spawnGroup,
  supervise,
  wait,
  waitForStartup
} from './dev-agent-supervisor'

const execFileAsync = promisify(execFile)
const CLOUD_QUICKSTART =
  'start the cloud stack first: `cloud up` from the cloud checkout, or scripts/start-all.sh'
const TEMPORAL_INSTALL =
  'brew install temporal, or: https://docs.temporal.io/cli#install'
// Fixed so a rerun seeds nothing and the printed recorder command never moves.
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

export interface ContainerService {
  name: string
  port: number
}

function internalPortForHostMapping(
  mapping: string,
  portNumber: number
): number | undefined {
  const match = mapping.match(
    /^(?:\[[^\]]+\]|[^:]+):(\d+)(?:-(\d+))?->(\d+)(?:-(\d+))?\/tcp$/
  )
  if (!match) return
  const hostStart = Number(match.at(1))
  const hostEnd = Number(match.at(2) ?? match.at(1))
  const internalStart = Number(match.at(3))
  const internalEnd = Number(match.at(4) ?? match.at(3))
  if (portNumber < hostStart || portNumber > hostEnd) return
  if (hostEnd - hostStart !== internalEnd - internalStart) {
    throw new Error(`Unsupported Docker port range: ${mapping}`)
  }
  return internalStart + portNumber - hostStart
}

export function containerServiceFromDockerPs(
  stdout: string,
  portNumber: number,
  service: string,
  image: string
): ContainerService {
  const byContainer = new Map<string, Set<number>>()
  const services = stdout
    .split('\n')
    .filter((value) => value !== '')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([, imageName]) =>
        imageName.replace(/@.+$/, '').replace(/:[^/]+$/, '') === image
    )
  for (const [name, , ...ports] of services) {
    for (const mapping of ports.join(' ').split(/,\s*/)) {
      const internalPort = internalPortForHostMapping(mapping, portNumber)
      if (internalPort === undefined) continue
      const internalPorts = byContainer.get(name) ?? new Set<number>()
      internalPorts.add(internalPort)
      byContainer.set(name, internalPorts)
    }
  }
  const containers = [...byContainer].map(([name, ports]) => {
    if (ports.size !== 1) {
      throw new Error(
        `${name} maps ${service} ${portNumber} to multiple internal ports: ${[...ports].join(', ')}`
      )
    }
    return { name, port: [...ports][0] }
  })
  if (containers.length === 0) {
    throw new Error(`No ${image} container publishes ${service} ${portNumber}`)
  }
  if (containers.length > 1) {
    throw new Error(
      `${containers.map(({ name }) => name).join(', ')} all publish ${service} ${portNumber}; stop the ones this recording should not use`
    )
  }
  return containers[0]
}

async function containerFor(
  portNumber: number,
  service: string,
  image: string
): Promise<ContainerService> {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '--format',
    '{{.Names}} {{.Image}} {{.Ports}}'
  ])
  return containerServiceFromDockerPs(stdout, portNumber, service, image)
}

export function pgContainerExecCommand({ name, port }: ContainerService) {
  return `docker exec -i ${name} psql -p ${port} -U postgres -d postgres -At -c`
}

export function redisContainerExecCommand({ name, port }: ContainerService) {
  return `docker exec -i ${name} redis-cli -p ${port}`
}

type ContainerLookup = typeof containerFor

export async function pgExecCommand(
  override: string,
  portNumber: number,
  lookup: ContainerLookup = containerFor
): Promise<string> {
  if (override) return override
  const container = await lookup(portNumber, 'Postgres', 'postgres')
  return pgContainerExecCommand(container)
}

export async function redisExecCommand(
  override: string,
  portNumber: number,
  lookup: ContainerLookup = containerFor
): Promise<string> {
  if (override) return override
  const container = await lookup(portNumber, 'Redis', 'redis')
  return redisContainerExecCommand(container)
}

export async function recordServiceExecCommands(
  options: Pick<Options, 'pgExec' | 'pgPort' | 'redisExec' | 'redisPort'>,
  lookup: ContainerLookup = containerFor
) {
  return {
    pgExec: await pgExecCommand(options.pgExec, options.pgPort, lookup),
    redisExec: await redisExecCommand(
      options.redisExec,
      options.redisPort,
      lookup
    )
  }
}

// Every value is a module constant, so the statement carries no caller input.
async function seedIdentity(command: string): Promise<void> {
  const parts = splitCommandLine(command)
  if (parts.length === 0) throw new Error('--pg-exec must name a command')
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
  const env = { ...process.env }
  for (const key of [
    'AGENT_RUNNER_ENDPOINT',
    'AGENT_SESSION_TOKEN',
    'AGENT_STANDALONE'
  ]) {
    delete env[key]
  }
  return {
    ...env,
    AGENT_BIND_ADDR: '127.0.0.1',
    AGENT_COMFY_URL: options.comfyUrl,
    AGENT_CRDT_MODE: 'on',
    AGENT_ENGINE: options.engine,
    AGENT_M2M_SECRET: secret,
    AGENT_PORT: String(options.agentPort),
    AGENT_TARGET: options.target,
    AGENT_WIDGET_CATALOG_PATH: catalogPath,
    DB_CONNECTION_STRING: `postgresql://postgres:postgres@127.0.0.1:${options.pgPort}/postgres?sslmode=disable`,
    DOC_HOST_ENDPOINT: `http://127.0.0.1:${options.docHostPort}`,
    HEALTH_PORT: String(options.healthPort),
    REDIS_URL: `redis://127.0.0.1:${options.redisPort}/1`,
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
  const { agentDir, agentUrl } = await preflightAgent(options, [
    'start.sh',
    'dochost/start.sh'
  ])
  await assertListening(options.pgPort, 'Postgres')
  await assertListening(options.redisPort, 'Redis')
  if (options.engine === 'temporal') await assertTemporalCli()

  const dataDir = await mkdtemp(resolve(tmpdir(), 'comfy-agent-record-'))
  const secretPath = resolve(dataDir, 'm2m.secret')
  const secret = randomBytes(32).toString('hex')
  await writeFile(secretPath, secret, { mode: 0o600 })
  let catalogPath: string
  let pgExec: string
  let redisExec: string
  try {
    catalogPath = await writeCatalog(options.catalog, dataDir)
    const commands = await recordServiceExecCommands(options)
    pgExec = commands.pgExec
    redisExec = commands.redisExec
    await seedIdentity(pgExec)
  } catch (error) {
    await rm(dataDir, { force: true, recursive: true })
    throw error
  }

  const supervisor = supervise(dataDir)
  try {
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
    await assertFree(options.docHostPort, 'Doc host')
    const docHost = spawnGroup('bash', ['dochost/start.sh'], agentDir, {
      ...process.env,
      DOC_HOST_PORT: String(options.docHostPort)
    })
    supervisor.watch(docHost)
    const docHostStartupResult = await waitForStartup(
      docHost,
      `http://127.0.0.1:${options.docHostPort}/health`,
      'Doc host',
      supervisor
    )
    if (docHostStartupResult !== null) {
      return await supervisor.stop(docHostStartupResult)
    }
    await assertFree(options.agentPort, 'Agent')
    await assertFree(options.healthPort, 'Agent health')
    const agent = spawnGroup(
      'bash',
      ['start.sh'],
      agentDir,
      recordEnv(options, catalogPath, secret)
    )
    supervisor.watch(agent)

    const startupResult = await waitForStartup(
      agent,
      `${agentUrl}/health`,
      'Standalone agent',
      supervisor
    )
    if (startupResult !== null) return await supervisor.stop(startupResult)
    const cloudSha = (
      await execFileAsync('git', ['-C', options.cloudRepo, 'rev-parse', 'HEAD'])
    ).stdout.trim()
    process.stdout.write(
      `
Recording stack ready: agent ${agentUrl}, doc host http://127.0.0.1:${options.docHostPort}
Record a case with:

AGENT_CLOUD_SHA=${cloudSha} AGENT_MODEL=<model>${options.target === 'cloud' ? ' AGENT_TURN_TOKEN=<cloud-api-key>' : ''} \\
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
