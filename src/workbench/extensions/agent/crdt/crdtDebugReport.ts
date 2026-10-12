import {
  REDACTED,
  sanitizeSecrets,
  sanitizeEventPayloads,
  sanitizeArgv
} from '@/platform/telemetry/redact'
import { DISTRIBUTION } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type {
  AssistantMessage,
  ToolPart
} from '../services/agent/agentMessageParts'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import type { DevEvent } from './crdtLog'
import { devEventReplacer } from './crdtLog'
import type { MergeTraceEntry } from './mergeTrace'
import type { MediaUiDiagnostic } from './mediaUiDiagnostics'
const MAX_LOG_CHARS = 40000
const MAX_WORKFLOW_CHARS = 200000
const MAX_SECTION_CHARS = 60000
const MAX_REPORT_CHARS = 256000
const MAX_TOOL_CALLS = 50
const SOURCE_TIMEOUT_MS = 5000
const SHARING_WARNING =
  'Review before sharing: this section can contain values you did not choose to publish.'
export interface ReportSources {
  serverLogs: boolean
  settings: boolean
  workflow: boolean
}
export const DEFAULT_REPORT_SOURCES: ReportSources = {
  serverLogs: true,
  settings: true,
  workflow: true
}
export interface ReportIdentifiers {
  userId: string | null
  organizationId: string | null
  workspaceId: string | null
  agentThreadId: string | null
  activeAgentTurnId: string | null
  recentAgentTurnIds: readonly string[]
  tabId: string | null
  activeJobId: string | null
  recentJobIds: readonly string[]
  workflowPath: string | null
  workflowId: string | null
  graphId: string | null
  docId: string | null
  crdtSequence: number | null
  crdtLamport: number | null
  clientId: string | null
  deployEnv: string | null
  backendUrl: string
}
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
  identifiers?: ReportIdentifiers
  sources?: ReportSources
  testerNote?: string
  mergeTrace?: readonly MergeTraceEntry[]
  workflow?: unknown
  workflowError?: string
  agentMessages?: readonly AssistantMessage[]
  mediaUiDiagnostics?: readonly MediaUiDiagnostic[]
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
      surface: 'agent',
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
function fitMediaDiagnostics(
  diagnostics: readonly MediaUiDiagnostic[]
): readonly MediaUiDiagnostic[] {
  const retained: MediaUiDiagnostic[] = []
  let serializedLength = '[\n\n]'.length
  for (const diagnostic of diagnostics) {
    const diagnosticJson = json(diagnostic)
    const indentedLength =
      diagnosticJson.length + diagnosticJson.split('\n').length * 2
    const separatorLength = retained.length > 0 ? ',\n'.length : 0
    if (
      serializedLength + separatorLength + indentedLength >
      MAX_SECTION_CHARS
    ) {
      break
    }
    retained.push(diagnostic)
    serializedLength += separatorLength + indentedLength
  }
  return retained
}
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const start = text.length - max
  const safeStart =
    text.charCodeAt(start) >= 0xdc00 && text.charCodeAt(start) <= 0xdfff
      ? start + 1
      : start
  return `…(${safeStart} earlier characters trimmed)…\n${text.slice(safeStart)}`
}
function truncateReport(text: string): string {
  if (text.length <= MAX_REPORT_CHARS) return text
  const marker = `\n\n[report truncated to ${MAX_REPORT_CHARS} characters]\n\n`
  const available = MAX_REPORT_CHARS - marker.length
  const headLength = Math.floor(available * 0.75)
  const tailStart = text.length - (available - headLength)
  const safeHeadLength =
    text.charCodeAt(headLength - 1) >= 0xd800 &&
    text.charCodeAt(headLength - 1) <= 0xdbff
      ? headLength - 1
      : headLength
  const safeTailStart =
    text.charCodeAt(tailStart) >= 0xdc00 && text.charCodeAt(tailStart) <= 0xdfff
      ? tailStart + 1
      : tailStart
  return `${text.slice(0, safeHeadLength)}${marker}${text.slice(safeTailStart)}`
}
type SystemStats = Awaited<ReturnType<typeof api.getSystemStats>>
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function systemSection(stats: SystemStats | null): string {
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
    `- **Arguments:** ${sanitizeArgv(argv)}`,
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
    `- **Schema version:** ${crdt.meta.schema_version ?? 'unknown'}`,
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
function serializeWorkflow(input: CrdtDebugReportInput):
  | {
      status: string
      section?: string
    }
  | undefined {
  const sources = input.sources ?? DEFAULT_REPORT_SOURCES
  if (!sources.workflow) return { status: 'turned off' }
  if (input.workflowError !== undefined) {
    return {
      status: 'failed (see source section)',
      section: fence(
        'text',
        truncate(
          String(sanitizeSecrets(input.workflowError)),
          MAX_SECTION_CHARS
        )
      )
    }
  }
  if (input.workflow === undefined) return { status: 'unavailable' }
  let serialized: string
  try {
    serialized = JSON.stringify(input.workflow, devEventReplacer(), 2)
  } catch (error) {
    return {
      status: 'failed (see source section)',
      section: fence(
        'text',
        truncate(String(sanitizeSecrets(String(error))), MAX_SECTION_CHARS)
      )
    }
  }
  if (serialized.length > MAX_WORKFLOW_CHARS) {
    return {
      status: `omitted (over ${MAX_WORKFLOW_CHARS} characters)`,
      section: fence(
        'json',
        `<workflow omitted: ${serialized.length} characters — attach the .json file instead>`
      )
    }
  }
  return { status: 'collected', section: fence('json', serialized) }
}
type RetainedToolCall = Pick<
  ToolPart,
  'callId' | 'name' | 'state' | 'ok' | 'durationMs'
> & {
  turnId: AssistantMessage['id']
}
function fitToolCalls(calls: readonly RetainedToolCall[], context: string) {
  let start = 0
  let body = json(sanitizeSecrets(calls))
  let section = [context, fence('json', body)].join('\n\n')
  while (section.length > MAX_SECTION_CHARS) {
    start++
    body = json(sanitizeSecrets(calls.slice(start)))
    section = [context, fence('json', body)].join('\n\n')
  }
  return { section, retained: calls.length - start }
}
function collectAgentToolCalls(messages: readonly AssistantMessage[]) {
  const calls: RetainedToolCall[] = []
  let total = 0
  for (const message of [...messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (part.type !== 'tool') continue
      total++
      if (calls.length === MAX_TOOL_CALLS) continue
      calls.push({
        turnId: message.id,
        callId: part.callId,
        name: part.name,
        state: part.state,
        ok: part.ok,
        durationMs: part.durationMs
      })
    }
  }
  return { calls: calls.reverse(), total }
}
function agentToolSection(messages: readonly AssistantMessage[] | undefined) {
  const context =
    'Current conversation metadata retained in this tab only. Restored history may omit tool calls. Durations are backend-reported; missing ok or durationMs means no outcome or timing was observed. State is the retained UI state, not proof a request is still running. No arguments, responses, prompts or reasoning are included.'
  if (messages === undefined) {
    return { section: context, status: 'unavailable' }
  }
  const { calls, total } = collectAgentToolCalls(messages)
  const fitted = fitToolCalls(calls, context)
  return {
    section: fitted.section,
    status:
      total === 0
        ? 'no retained calls'
        : `${total > fitted.retained ? 'truncated' : 'collected'} (${fitted.retained}/${total} retained calls)`
  }
}
function formatSource<T>(
  result: Awaited<ReturnType<typeof attempt<T>>> | null,
  warning: string,
  renderValue: (value: T) => string
): {
  section: string
  status: string
} {
  if (result === null) {
    return {
      section: '_Not included. Turned off by the tester._',
      status: 'turned off'
    }
  }
  if (!result.ok) {
    return {
      section: [warning, `_${result.label} unavailable: ${result.error}_`].join(
        '\n\n'
      ),
      status: 'failed (see source section)'
    }
  }
  return {
    section: [warning, renderValue(result.value)].join('\n\n'),
    status: 'collected'
  }
}
function frontendSection(): string {
  const extensionNames = (() => {
    try {
      return useExtensionStore().extensions.map((extension) => extension.name)
    } catch (error) {
      return [`<unavailable: ${String(error)}>`]
    }
  })()
  return [
    `- **Frontend version:** ${__COMFYUI_FRONTEND_VERSION__}`,
    `- **Frontend commit:** ${__COMFYUI_FRONTEND_COMMIT__}`,
    `- **Distribution:** ${DISTRIBUTION}`,
    `- **Deploy environment:** ${useSystemStatsStore().systemStats?.system.deploy_environment ?? 'unknown'}`,
    `- **User agent:** ${navigator.userAgent}`,
    `- **Viewport:** ${window.innerWidth}×${window.innerHeight}`,
    `- **Extensions (${extensionNames.length}):** ${extensionNames.join(', ') || 'none'}`
  ].join('\n')
}
export async function collectCrdtDebugReport(
  input: CrdtDebugReportInput
): Promise<string> {
  const sources = input.sources ?? DEFAULT_REPORT_SOURCES
  const agentTools = agentToolSection(input.agentMessages)
  const [stats, logs, settings] = await Promise.all([
    attempt('System stats', async () => {
      const store = useSystemStatsStore()
      await store.refetchSystemStats()
      if (store.error) throw store.error
      return store.systemStats
    }),
    sources.serverLogs ? attempt('Server logs', () => api.getLogs()) : null,
    sources.settings ? attempt('Settings', () => api.getSettings()) : null
  ])
  const systemReport = formatSource(
    stats,
    `${SHARING_WARNING} System details can identify your hardware, software versions and launch configuration.`,
    systemSection
  )
  const logsReport = formatSource(
    logs,
    `${SHARING_WARNING} Backend logs can echo prompts, file paths and tokens.`,
    (value) => fence('text', truncate(value, MAX_LOG_CHARS))
  )
  const settingsReport = formatSource(
    settings,
    `${SHARING_WARNING} Values under keys that look like credentials are replaced with \`${REDACTED}\`, at every depth — but a custom node may name a secret anything.`,
    (value) =>
      fence('json', truncate(json(sanitizeSecrets(value)), MAX_SECTION_CHARS))
  )
  const workflow = serializeWorkflow(input)
  const mediaUiDiagnostics =
    input.mediaUiDiagnostics === undefined
      ? undefined
      : fitMediaDiagnostics(input.mediaUiDiagnostics)
  const mediaUiStatus =
    mediaUiDiagnostics === undefined
      ? 'unavailable'
      : mediaUiDiagnostics.length === input.mediaUiDiagnostics?.length
        ? `collected (${mediaUiDiagnostics.length} nodes)`
        : `collected (${mediaUiDiagnostics.length} of ${input.mediaUiDiagnostics?.length} nodes; section limit)`
  const collectionStatus = (
    [
      ['System stats', systemReport],
      ['Server logs', logsReport],
      ['Settings', settingsReport],
      ['Agent tool calls', agentTools]
    ] as const
  ).map(([label, result]) => `- ${label}: ${result.status}`)
  const sections: string[] = [
    '# ComfyUI Agent — CRDT debug report',
    `Generated ${new Date().toISOString()}`,
    `Report format version: 2 · Document schema version: ${input.crdt.meta.schema_version ?? 'unknown'} · Redaction marker: ${REDACTED}`,
    '## Identifiers',
    'Paste this block into a bug report or search Datadog/logs by any of these fields.',
    identifiersSection(input.identifiers ?? EMPTY_REPORT_IDENTIFIERS),
    '## Collection status',
    [
      ...collectionStatus,
      `- Media UI diagnostics: ${mediaUiStatus}`,
      `- Workflow: ${workflow?.status ?? 'unavailable'}`
    ].join('\n')
  ]
  if (input.testerNote?.trim()) {
    sections.push(
      '## What the tester expected',
      input.testerNote.trim(),
      '_(This is the tester\u2019s own description of the expected merge behaviour — treat it as a product signal, not a bug repro.)_'
    )
  }
  sections.push('## CRDT state', crdtSection(input.crdt))
  if (mediaUiDiagnostics !== undefined) {
    sections.push(
      '## Media UI diagnostics',
      'Counts and booleans only; selected filenames and resolved media URLs are not included.',
      fence('json', json(mediaUiDiagnostics))
    )
  }
  sections.push('## Agent tool calls', agentTools.section)
  if (input.mergeTrace?.length) {
    sections.push('## Merge trace', mergeSection(input.mergeTrace))
  }
  sections.push('## Frontend', frontendSection())
  sections.push('## System', systemReport.section)
  sections.push(
    '## CRDT event log',
    `${SHARING_WARNING} Operation payload values appear as \`${REDACTED}\`; op ids and workflow ids appear verbatim.`,
    fence(
      'json',
      truncate(json(sanitizeEventPayloads(input.events)), MAX_SECTION_CHARS)
    )
  )
  sections.push(
    '## Document stamps (LWW ledger)',
    `${SHARING_WARNING} Stamp keys name every actor that wrote to the document.`,
    fence('json', truncate(json(input.crdt.stamps), MAX_SECTION_CHARS))
  )
  if (workflow?.section !== undefined) {
    sections.push(
      '## Workflow',
      `${SHARING_WARNING} Prompts and API keys embedded in nodes appear verbatim.`,
      workflow.section
    )
  }
  sections.push('## Settings', settingsReport.section)
  sections.push('## Server logs', logsReport.section)
  return truncateReport(sections.join('\n\n'))
}
