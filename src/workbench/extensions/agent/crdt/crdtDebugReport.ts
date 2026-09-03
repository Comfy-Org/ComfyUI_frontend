/**
 * The one-click bug report.
 *
 * The frontend used to ship a `ReportIssuePanel` that gathered system stats,
 * server logs, settings and the workflow behind opt-in checkboxes and posted
 * the bundle to Sentry; it was deleted when support moved to Zendesk (#5259),
 * and with it went the only path from "something is wrong" to "here is
 * everything an engineer needs". The panel's `Copy JSON` replacement carried
 * the CRDT event log and nothing else — no versions, no logs, no custom
 * nodes — so every CRDT report arrived needing a follow-up round trip.
 *
 * This restores the deleted collector and folds the CRDT state into the same
 * artifact: one clipboard paste that answers "what build", "what machine",
 * "what nodes", "what did the document do", and "what did the tester expect
 * instead".
 *
 * Collection is per-source fault-tolerant on purpose. A backend that is down
 * is exactly when a report matters most, and a failed `getLogs()` must
 * degrade to a note in the log section rather than abort the whole bundle.
 */
import { DISTRIBUTION } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'

import type { CrdtDebugSnapshot } from './crdtSnapshot'
import type { DevEvent } from './devPanelLog'
import { devEventReplacer } from './devPanelLog'
import type { MergeTraceEntry } from './mergeTrace'

/** Server logs beyond this are tail-trimmed; a paste has to stay pasteable. */
const MAX_LOG_CHARS = 40_000
const MAX_WORKFLOW_CHARS = 200_000
/** The event log and the stamp ledger both grow without bound with session length. */
const MAX_SECTION_CHARS = 60_000
const MAX_REDACTION_DEPTH = 12
const DEPTH_LIMIT_REDACTED = '[redacted at depth limit]'
const SOURCE_TIMEOUT_MS = 5_000

/**
 * Setting keys whose VALUE is replaced before the report leaves the browser.
 *
 * `addSetting` is public extension API, so the settings dictionary is an open
 * set: any installed node pack can persist whatever it likes there, including
 * service credentials. An allow-list is impossible for the same reason, so
 * this redacts by key shape and the report says so out loud.
 */
const SECRET_KEY_PATTERN =
  /(token|secret|password|passwd|credential|api[-_]?key|apikey|auth|bearer|session|cookie|private)/i

const REDACTED = '[redacted by the debug report]'

const SHARING_WARNING =
  'Review before sharing: this section can contain values you did not choose to publish.'

/** Heads the CRDT event log both in the report and in the panel's copied log. */
export const EVENT_LOG_WARNING = `${SHARING_WARNING} Operation payload values are redacted; op ids and workflow ids appear verbatim.`

/**
 * Redaction must RECURSE. A single top-level pass reads as sufficient and is
 * not: `Comfy.Server.LaunchArgs` is a `Record<string, string>` of the flags
 * the server was started with, and its own key matches nothing, so a
 * one-level walk emits `{'--api-token': '…'}` whole. Settings values are
 * arbitrary JSON from a public `addSetting` API, so every key at every depth
 * has to be tested.
 */
function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACTION_DEPTH) return DEPTH_LIMIT_REDACTED
  if (typeof value === 'string') return redactPrivateValue(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1))
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(nested, depth + 1)
    ])
  )
}

/**
 * The sources a tester must opt into.
 *
 * The panel this replaced shipped everything unconditionally. The dialog
 * DELETED in #5259 did not: it listed Workflow, Logs, Settings AND SystemStats
 * as unchecked opt-ins under "what can we include", and restoring the
 * collection without restoring that choice would be a privacy regression
 * dressed as a feature.
 *
 * SystemStats is deliberately NOT gated here: it is the "copy system stats"
 * capability this report exists to provide, and the only privacy-bearing part
 * of it — `argv` — is redacted by {@link redactArgv} instead. Versions, OS and
 * RAM carry nothing a tester would withhold.
 */
export interface ReportSources {
  serverLogs: boolean
  settings: boolean
  workflow: boolean
}

export const DEFAULT_REPORT_SOURCES: ReportSources = {
  serverLogs: false,
  settings: false,
  workflow: false
}

/**
 * The IDs a backend engineer needs to find this session in Datadog/logs,
 * without reading the rest of the report. None of these are secrets — they
 * are the join keys support and backend already search by — so this block
 * is included unconditionally, unlike the opt-in {@link ReportSources}.
 *
 * Collected by the caller (the panel component) rather than read directly in
 * this module, because every value here lives behind a Pinia store or a
 * composable and this module deliberately stays framework-store-free — see
 * the file header on why collection is fault-tolerant per source instead.
 */
export interface ReportIdentifiers {
  /** Comfy account id, from Firebase or an API-key session. */
  userId: string | null
  /** Organization id, when the active workspace exposes a separate one. */
  organizationId: string | null
  /** Active team/workspace id, when the tester is in one. */
  workspaceId: string | null
  /** Agent conversation/thread id — the backend session correlation key. */
  agentThreadId: string | null
  /** Current agent request/turn id. */
  activeAgentTurnId: string | null
  /** Recent agent request/turn ids, most recent first. */
  recentAgentTurnIds: readonly string[]
  /** Per-tab CRDT actor id — the closest thing to a "session id" today. */
  tabId: string | null
  /** The prompt/job id currently executing, if any. */
  activeJobId: string | null
  /** Prompt/job ids from queue history, most recent first. */
  recentJobIds: readonly string[]
  /** Active workflow's path, which is what the workflow store keys on. */
  workflowPath: string | null
  /** Persisted workflow id used by the agent/CRDT backend. */
  workflowId: string | null
  /** Workflow JSON graph id. */
  graphId: string | null
  /** CRDT document id — the same id as {@link CrdtDebugSnapshot.status.workflowId}. */
  docId: string | null
  /** Last host sequence observed by the follower. */
  crdtSequence: number | null
  /** Highest Lamport counter currently present in the document stamp ledger. */
  crdtLamport: number | null
  /** ComfyUI server-assigned websocket session id (`api.clientId`). */
  clientId: string | null
  /** `location.hostname`-derived deploy env (`prod-v2`/`stg-v2`/`test-v2`/…). */
  deployEnv: string | null
  /** The ComfyUI server this client is talking to (`api.api_host` + `api.api_base`). */
  backendUrl: string
}

/** Every field unknown — the fallback when a caller has none to report. */
export const EMPTY_REPORT_IDENTIFIERS: ReportIdentifiers = {
  userId: null,
  organizationId: null,
  workspaceId: null,
  agentThreadId: null,
  activeAgentTurnId: null,
  recentAgentTurnIds: [],
  tabId: null,
  activeJobId: null,
  recentJobIds: [],
  workflowPath: null,
  workflowId: null,
  graphId: null,
  docId: null,
  crdtSequence: null,
  crdtLamport: null,
  clientId: null,
  deployEnv: null,
  backendUrl: 'unknown'
}

export interface CrdtDebugReportInput {
  crdt: CrdtDebugSnapshot
  events: readonly DevEvent[]
  /**
   * IDs for finding this session in Datadog/logs. The real caller
   * (`CrdtDevPanel.vue`) always supplies this; optional here only so a
   * synthetic input (a test) is not forced to construct every field.
   */
  identifiers?: ReportIdentifiers
  /** Which sensitive sources the tester agreed to include. */
  sources?: ReportSources
  /** Whatever the tester typed into "what did you expect instead?". */
  testerNote?: string
  /** Merge-lab results the tester was looking at, if any. */
  mergeTrace?: readonly MergeTraceEntry[]
  /** Serialized active workflow, when the caller can supply one. */
  workflow?: unknown
}

async function attempt<T>(label: string, load: () => Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const value = await Promise.race([
      load(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          SOURCE_TIMEOUT_MS
        )
      })
    ])
    return { label, ok: true as const, value }
  } catch (error) {
    reportError(error, {
      errorType: 'agent_crdt_debug_report_source_failed',
      tags: { source: label },
      level: 'warning'
    })
    return { label, ok: false as const, error: String(error) }
  } finally {
    clearTimeout(timeout)
  }
}

function fence(language: string, body: string): string {
  // Server logs and workflow JSON are untrusted text: a body containing its
  // own fence would otherwise terminate the block early and let the rest of
  // the payload render as markdown.
  const longestRun = [...body.matchAll(/`+/g)].reduce(
    (max, match) => Math.max(max, match[0].length),
    0
  )
  const delimiter = '`'.repeat(Math.max(3, longestRun + 1))
  return [delimiter + language, body, delimiter].join('\n')
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value, devEventReplacer(), 2)
  } catch (error) {
    return `<unserializable: ${String(error)}>`
  }
}

export function redactEventPayloads(
  value: readonly DevEvent[]
): readonly DevEvent[]
export function redactEventPayloads(value: unknown): unknown
export function redactEventPayloads(value: unknown): unknown {
  return redactPayloadTree(value, 0)
}

/**
 * Every wire-op field that carries user workflow content: `set_widget.value`
 * and its informational `old` (the value before the write), the verbatim node
 * snapshot on `add_node`, `widgets_values` inside any snapshot, and the full
 * `reset_doc.workflow`. Events record whole ops (`ws_out` frames,
 * `human_ops_settled` outcomes), so masking `value` alone still leaks the
 * previous prompt through `old`.
 */
const CONTENT_KEYS: ReadonlySet<string> = new Set([
  'value',
  'old',
  'widgets_values',
  'node',
  'workflow'
])

/**
 * Runs before `devEventReplacer`, so anything it rebuilds is what the
 * replacer sees. Binary views stay intact for the replacer to summarize
 * (`Object.entries(new Uint8Array(4))` would otherwise flatten them into
 * index-keyed records), and the depth cap turns a cyclic detail into a marker
 * instead of a `RangeError` that `copyLog` would swallow.
 */
function redactPayloadTree(value: unknown, depth: number): unknown {
  if (depth > MAX_REDACTION_DEPTH) return DEPTH_LIMIT_REDACTED
  if (Array.isArray(value)) {
    return value.map((item) => redactPayloadTree(item, depth + 1))
  }
  if (!isRecord(value) || isBinary(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      CONTENT_KEYS.has(key) ? REDACTED : redactPayloadTree(nested, depth + 1)
    ])
  )
}

function isBinary(value: object): boolean {
  return (
    ArrayBuffer.isView(value) ||
    Object.prototype.toString.call(value) === '[object ArrayBuffer]'
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `…(${text.length - max} earlier characters trimmed)…\n${text.slice(-max)}`
}

type SystemStats = Awaited<ReturnType<typeof api.getSystemStats>>

/**
 * A value is anything not starting with `-`; only a leading dash makes a token
 * a flag. Pattern-testing every token instead treated `/home/me/private/x` as
 * a flag — leaking it and blanking the harmless argument after it.
 *
 * Two rules: a credential-shaped FLAG blanks its value, and a value that looks
 * like an absolute path or a URL is blanked whatever names it, because
 * `--output-directory` and `--extra-model-paths-config` carry private paths
 * under a flag no credential pattern matches.
 */
const PRIVATE_VALUE_PATTERN =
  /(^|=)(\/|~|[A-Za-z]:[\\/]|\\\\|\.{1,2}[\\/])|:\/\//

function redactPrivateValue(value: string): string {
  return PRIVATE_VALUE_PATTERN.test(value) ? REDACTED : value
}

function redactArgv(argv: readonly string[]): string {
  const parts: string[] = []
  let flagWantsSecretValue = false

  for (const arg of argv) {
    if (flagWantsSecretValue) {
      parts.push(REDACTED)
      flagWantsSecretValue = false
      continue
    }
    flagWantsSecretValue = false

    if (!arg.startsWith('-')) {
      parts.push(redactPrivateValue(arg))
      continue
    }
    const eq = arg.indexOf('=')
    const flag = eq === -1 ? arg : arg.slice(0, eq)
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1)
    if (inlineValue !== undefined) {
      const secret =
        SECRET_KEY_PATTERN.test(flag) || PRIVATE_VALUE_PATTERN.test(inlineValue)
      parts.push(secret ? `${flag}=${REDACTED}` : arg)
      flagWantsSecretValue = false
      continue
    }
    parts.push(arg)
    flagWantsSecretValue = SECRET_KEY_PATTERN.test(flag)
  }
  return parts.join(' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function systemSection(stats: SystemStats): string {
  const payload: Record<string, unknown> = isRecord(stats) ? stats : {}
  const system = isRecord(payload.system) ? payload.system : {}
  const argv = Array.isArray(system.argv) ? system.argv.map(String) : []
  const devices = Array.isArray(payload.devices) ? payload.devices : []
  const lines = [
    `- **ComfyUI version:** ${system.comfyui_version ?? '?'}`,
    `- **OS:** ${system.os ?? '?'}`,
    `- **Python:** ${system.python_version ?? '?'}`,
    `- **Embedded Python:** ${system.embedded_python ?? '?'}`,
    `- **PyTorch:** ${system.pytorch_version ?? '?'}`,
    `- **Arguments:** ${redactArgv(argv)}`,
    `- **RAM:** ${system.ram_free ?? '?'} free / ${system.ram_total ?? '?'} total`
  ]
  if (system.cloud_version)
    lines.push(`- **Cloud version:** ${system.cloud_version}`)
  if (system.comfyui_frontend_version)
    lines.push(
      `- **Frontend (reported by backend):** ${system.comfyui_frontend_version}`
    )
  for (const device of devices) {
    if (!isRecord(device)) {
      lines.push('- **Device ?:** unavailable')
      continue
    }
    lines.push(
      `- **Device ${device.index ?? '?'}:** ${device.name} (${device.type}) — VRAM ${device.vram_free} free / ${device.vram_total} total, torch ${device.torch_vram_free} / ${device.torch_vram_total}`
    )
  }
  return lines.join('\n')
}

/**
 * Every value here is a search key, not a secret — a backend engineer greps
 * Datadog by exactly these fields, so `none`/`unknown` is written out loud
 * rather than omitting the row: a missing bullet reads as "not collected",
 * an explicit `none` reads as "collected, and there isn't one".
 */
function identifiersSection(identifiers: ReportIdentifiers): string {
  return [
    `- **User id:** ${identifiers.userId ?? 'none (not logged in)'}`,
    `- **Organization id:** ${identifiers.organizationId ?? 'none (not exposed separately)'}`,
    `- **Workspace id:** ${identifiers.workspaceId ?? 'none'}`,
    `- **Agent session/thread id:** ${identifiers.agentThreadId ?? 'none'}`,
    `- **Active agent request/turn id:** ${identifiers.activeAgentTurnId ?? 'none'}`,
    `- **Recent agent request/turn ids:** ${identifiers.recentAgentTurnIds.length ? identifiers.recentAgentTurnIds.join(', ') : 'none'}`,
    `- **Client id:** ${identifiers.clientId ?? 'unknown'}`,
    `- **Tab/session id:** ${identifiers.tabId ?? 'unknown'}`,
    `- **Active job/prompt id:** ${identifiers.activeJobId ?? 'none'}`,
    `- **Recent job/prompt ids:** ${identifiers.recentJobIds.length ? identifiers.recentJobIds.join(', ') : 'none'}`,
    `- **Workflow path:** ${identifiers.workflowPath ?? 'none'}`,
    `- **Workflow id:** ${identifiers.workflowId ?? 'none'}`,
    `- **Document/graph id:** ${identifiers.graphId ?? 'none'}`,
    `- **CRDT doc id:** ${identifiers.docId ?? 'none'}`,
    `- **CRDT room id:** ${identifiers.docId ?? 'none'}`,
    `- **CRDT sequence/clock:** ${identifiers.crdtSequence ?? 'none'}`,
    `- **CRDT Lamport counter:** ${identifiers.crdtLamport ?? 'none'}`,
    `- **Backend URL:** ${identifiers.backendUrl}`,
    `- **Deploy env:** ${identifiers.deployEnv ?? 'unknown'}`,
    `- **Frontend commit:** ${__COMFYUI_FRONTEND_COMMIT__}`,
    `- **Frontend version:** ${__COMFYUI_FRONTEND_VERSION__}`,
    `- **Distribution:** ${DISTRIBUTION}`,
    `- **Timestamp (UTC):** ${new Date().toISOString()}`,
    `- **User agent:** ${navigator.userAgent}`
  ].join('\n')
}

function crdtSection(crdt: CrdtDebugSnapshot): string {
  return [
    `- **Enabled:** ${crdt.status.enabled}`,
    `- **Connected:** ${crdt.status.connected}`,
    `- **Doc id:** ${crdt.status.workflowId ?? 'none'}`,
    `- **Updates applied:** ${crdt.status.updatesApplied}`,
    `- **Last frame:** ${crdt.status.lastFrameType ?? 'none'}`,
    `- **Tab id:** ${crdt.tabId ?? 'unknown'}`,
    `- **Last seq:** ${crdt.lastSeq ?? 'none'}`,
    `- **Schema error:** ${crdt.schemaError ?? 'none'}`,
    `- **Doc nodes (${crdt.nodeIds.length}):** ${crdt.nodeIds.join(', ') || 'none'}`,
    `- **Doc links (${crdt.linkIds.length}):** ${crdt.linkIds.join(', ') || 'none'}`,
    `- **Applied op ids:** ${crdt.appliedOpIds.length}`
  ].join('\n')
}

function mergeSection(entries: readonly MergeTraceEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${entry.index + 1}. \`${entry.kind}\` by ${entry.actor} on ${entry.registerLabel} → **${entry.verdict.kind}**\n   ${entry.explanation}`
    )
    .join('\n')
}

/**
 * Build the full markdown report.
 *
 * Ordered for the reader, not for the collector: the tester's own words come
 * first, then CRDT state, then the environment, then the raw transcripts. An
 * engineer reading it top-down should be able to stop as soon as they have
 * enough.
 */
export async function collectCrdtDebugReport(
  input: CrdtDebugReportInput
): Promise<string> {
  const extensionNames = (() => {
    try {
      return useExtensionStore().extensions.map((extension) => extension.name)
    } catch (error) {
      return [`<unavailable: ${String(error)}>`]
    }
  })()

  const sources = input.sources ?? DEFAULT_REPORT_SOURCES
  const [stats, logs, settings] = await Promise.all([
    attempt('System stats', () => api.getSystemStats()),
    sources.serverLogs ? attempt('Server logs', () => api.getLogs()) : null,
    sources.settings ? attempt('Settings', () => api.getSettings()) : null
  ])

  const sections: string[] = [
    '# ComfyUI Agent — CRDT debug report',
    `Generated ${new Date().toISOString()}`,
    '## Identifiers',
    'Paste this block into a bug report or search Datadog/logs by any of these fields.',
    identifiersSection(input.identifiers ?? EMPTY_REPORT_IDENTIFIERS)
  ]

  if (input.testerNote?.trim()) {
    sections.push(
      '## What the tester expected',
      input.testerNote.trim(),
      '_(This is the tester\u2019s own description of the expected merge behaviour — treat it as a product signal, not a bug repro.)_'
    )
  }

  sections.push('## CRDT state', crdtSection(input.crdt))

  if (input.mergeTrace?.length) {
    sections.push('## Merge trace', mergeSection(input.mergeTrace))
  }

  sections.push(
    '## Frontend',
    [
      `- **Frontend version:** ${__COMFYUI_FRONTEND_VERSION__}`,
      `- **Frontend commit:** ${__COMFYUI_FRONTEND_COMMIT__}`,
      `- **Distribution:** ${DISTRIBUTION}`,
      `- **API base:** ${api.apiURL('')}`,
      `- **User agent:** ${navigator.userAgent}`,
      `- **Viewport:** ${window.innerWidth}×${window.innerHeight}`,
      `- **Extensions (${extensionNames.length}):** ${extensionNames.join(', ') || 'none'}`
    ].join('\n')
  )

  sections.push(
    '## System',
    `${SHARING_WARNING} System details can identify your hardware, software versions and launch configuration.`,
    stats.ok
      ? systemSection(stats.value)
      : `_${stats.label} unavailable: ${stats.error}_`
  )

  sections.push(
    '## CRDT event log',
    EVENT_LOG_WARNING,
    fence(
      'json',
      truncate(json(redactEventPayloads(input.events)), MAX_SECTION_CHARS)
    )
  )

  sections.push(
    '## Document stamps (LWW ledger)',
    `${SHARING_WARNING} Stamp keys name every actor that wrote to the document.`,
    fence('json', truncate(json(input.crdt.stamps), MAX_SECTION_CHARS))
  )

  if (sources.workflow && input.workflow !== undefined) {
    const serialized = json(input.workflow)
    sections.push(
      '## Workflow',
      `${SHARING_WARNING} Prompts and API keys embedded in nodes appear verbatim.`,
      fence(
        'json',
        serialized.length > MAX_WORKFLOW_CHARS
          ? `<workflow omitted: ${serialized.length} characters — attach the .json file instead>`
          : serialized
      )
    )
  }

  sections.push(
    '## Settings',
    settings === null
      ? `_Not included. The tester did not opt in to sharing settings._`
      : [
          `${SHARING_WARNING} Values under keys that look like credentials are replaced with \`${REDACTED}\`, at every depth — but a custom node may name a secret anything.`,
          settings.ok
            ? fence(
                'json',
                truncate(json(redactSecrets(settings.value)), MAX_SECTION_CHARS)
              )
            : `_${settings.label} unavailable: ${settings.error}_`
        ].join('\n\n')
  )

  sections.push(
    '## Server logs',
    logs === null
      ? `_Not included. The tester did not opt in to sharing server logs._`
      : [
          `${SHARING_WARNING} Backend logs can echo prompts, file paths and tokens.`,
          logs.ok
            ? fence('text', truncate(String(logs.value), MAX_LOG_CHARS))
            : `_${logs.label} unavailable: ${logs.error}_`
        ].join('\n\n')
  )

  return sections.join('\n\n')
}
