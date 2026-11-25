import { execFile } from 'node:child_process'
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { chromium } from '@playwright/test'
import ffmpegPath from 'ffmpeg-static'

import { parseAgentReplayBundle } from '../src/workbench/extensions/agent/replay/agentReplayBundle'
import type { AgentReplayBundleV1 } from '../src/workbench/extensions/agent/replay/agentReplayBundle'
import { renderAgentReplayDocument } from '../src/workbench/extensions/agent/replay/renderAgentReplayDocument'

const execFileAsync = promisify(execFile)
const usage = `Usage:
  pnpm agent-replay inspect --bundle <path>
  pnpm agent-replay fetch --id-file <path> --endpoint <url> --workspace <id> --requester <id> --reason <ref> --output <path>
  pnpm agent-replay render --bundle <path> --output <video.mp4> [--speed <number>]
  pnpm agent-replay run --id-file <path> --endpoint <url> --workspace <id> --requester <id> --reason <ref> --output <video.mp4> [--speed <number>]

AGENT_REPLAY_SUPPORT_SECRET is required for fetch and run.
`

type Command = 'inspect' | 'fetch' | 'render' | 'run'
type Options = Partial<Record<string, string>>

type CliInput = {
  command: Command
  options: Options
}

function isCommand(value: string | undefined): value is Command {
  return (
    value === 'inspect' ||
    value === 'fetch' ||
    value === 'render' ||
    value === 'run'
  )
}

function parseCli(argv: string[]): CliInput | undefined {
  const [rawCommand, ...args] = argv
  if (!isCommand(rawCommand)) return undefined
  if (args.length % 2 !== 0) return undefined
  const options: Options = {}
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!flag.startsWith('--')) return undefined
    options[flag.slice(2)] = value
  }
  return { command: rawCommand, options }
}

function required(options: Options, name: string): string {
  const value = options[name]?.trim()
  if (!value) throw new TypeError(`--${name} is required`)
  return value
}

async function loadBundle(path: string): Promise<AgentReplayBundleV1> {
  const raw = await readFile(resolve(path), 'utf8')
  const parsed: unknown = JSON.parse(raw)
  const bundle = parseAgentReplayBundle(parsed)
  if (!bundle.ok) throw new TypeError(bundle.detail)
  return bundle.bundle
}

async function readThreadId(path: string): Promise<string> {
  const threadId = (await readFile(resolve(path), 'utf8')).trim()
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      threadId
    )
  )
    throw new TypeError('id file must contain one UUID')
  return threadId
}

async function fetchBundle(options: Options, output: string): Promise<void> {
  const secret = process.env.AGENT_REPLAY_SUPPORT_SECRET
  if (!secret) throw new TypeError('AGENT_REPLAY_SUPPORT_SECRET is required')
  const threadId = await readThreadId(required(options, 'id-file'))
  const endpoint = required(options, 'endpoint').replace(/\/$/, '')
  const response = await fetch(
    `${endpoint}/internal/agent/replays/${threadId}`,
    {
      headers: {
        'X-Comfy-Replay-Support-Secret': secret,
        'X-Comfy-Workspace-ID': required(options, 'workspace'),
        'X-Comfy-Replay-Requester': required(options, 'requester'),
        'X-Comfy-Replay-Reason': required(options, 'reason')
      },
      redirect: 'error'
    }
  )
  if (!response.ok)
    throw new TypeError(`replay fetch failed with HTTP ${response.status}`)
  const value: unknown = await response.json()
  const parsed = parseAgentReplayBundle(value)
  if (!parsed.ok) throw new TypeError(parsed.detail)
  await writeFile(output, `${JSON.stringify(parsed.bundle)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  await chmod(output, 0o600)
}

function playbackTimes(bundle: AgentReplayBundleV1): number[] {
  return [...new Set(bundle.entries.map(({ at_ms: atMs }) => atMs))]
}

async function renderBundle(
  bundle: AgentReplayBundleV1,
  output: string,
  speed: number
): Promise<void> {
  if (!Number.isFinite(speed) || speed <= 0 || speed > 100)
    throw new TypeError('--speed must be greater than 0 and at most 100')
  const document = renderAgentReplayDocument(bundle)
  const renderedDuration = document.durationMs / speed
  if (renderedDuration > 120_000)
    throw new TypeError('rendered replay exceeds 120 seconds; increase --speed')

  const videoDirectory = await mkdtemp(join(tmpdir(), 'agent-replay-video-'))
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDirectory, size: { width: 1280, height: 720 } }
  })
  const page = await context.newPage()
  const video = page.video()
  try {
    await page.setContent(document.html, { waitUntil: 'load' })
    const times = playbackTimes(bundle)
    let previous = 0
    for (const atMs of times) {
      const delay = (atMs - previous) / speed
      if (delay > 0)
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delay))
      await page.evaluate((time) => {
        const replayWindow = window as typeof window & {
          setReplayTime?: (milliseconds: number) => void
        }
        replayWindow.setReplayTime?.(time)
      }, atMs)
      previous = atMs
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 750))
  } finally {
    await context.close()
    await browser.close()
  }
  if (!video) throw new TypeError('Playwright did not create a replay video')
  const webm = await video.path()
  try {
    if (!ffmpegPath) throw new TypeError('ffmpeg binary is unavailable')
    await execFileAsync(ffmpegPath, [
      '-y',
      '-loglevel',
      'error',
      '-i',
      webm,
      '-movflags',
      '+faststart',
      '-pix_fmt',
      'yuv420p',
      resolve(output)
    ])
    await chmod(resolve(output), 0o600)
  } catch (cause) {
    await unlink(resolve(output)).catch(() => undefined)
    throw cause
  } finally {
    await rm(videoDirectory, { recursive: true, force: true })
  }
}

async function inspect(options: Options): Promise<void> {
  const bundle = await loadBundle(required(options, 'bundle'))
  const rendered = renderAgentReplayDocument(bundle)
  process.stdout.write(
    `${JSON.stringify({
      replay_id: bundle.replay_id,
      thread_id: bundle.thread_id,
      fidelity: rendered.fidelity,
      reasons: bundle.fidelity.reasons,
      entries: bundle.entries.length,
      duration_ms: rendered.durationMs
    })}\n`
  )
}

async function execute({ command, options }: CliInput): Promise<void> {
  if (command === 'inspect') return inspect(options)
  if (command === 'fetch')
    return fetchBundle(options, resolve(required(options, 'output')))
  if (command === 'render') {
    const bundle = await loadBundle(required(options, 'bundle'))
    return renderBundle(
      bundle,
      resolve(required(options, 'output')),
      Number(options.speed ?? '1')
    )
  }

  const output = resolve(required(options, 'output'))
  const privateDirectory = await mkdtemp(join(tmpdir(), 'agent-replay-run-'))
  const bundlePath = join(privateDirectory, `${basename(output)}.json`)
  try {
    await fetchBundle(options, bundlePath)
    const bundle = await loadBundle(bundlePath)
    await renderBundle(bundle, output, Number(options.speed ?? '1'))
    process.stdout.write(
      `${JSON.stringify({ output, fidelity: renderAgentReplayDocument(bundle).fidelity })}\n`
    )
  } finally {
    await unlink(bundlePath).catch(() => undefined)
    await rm(privateDirectory, { recursive: true, force: true })
  }
}

const input = parseCli(process.argv.slice(2))
if (!input) {
  process.stderr.write(usage)
  process.exitCode = 1
} else {
  execute(input).catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause)
    process.stderr.write(`agent replay failed: ${message}\n`)
    process.exitCode = 1
  })
}
