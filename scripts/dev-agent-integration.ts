import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import type { Options } from './dev-agent-options'
import { PROJECT_ROOT, USAGE, parseOptions } from './dev-agent-options'
import { runRecord } from './dev-agent-record-mode'
import {
  assertReachable,
  spawnGroup,
  supervise,
  waitForAgent
} from './dev-agent-supervisor'

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
