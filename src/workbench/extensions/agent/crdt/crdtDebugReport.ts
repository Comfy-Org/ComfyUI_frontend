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
import {
  appliedOpIds,
  readGraph,
  readMeta,
  readStamps
} from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'

import type { DevEvent } from './devPanelLog'
import { devEventReplacer } from './devPanelLog'
import type { MergeTraceEntry } from './mergeTrace'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

/** Server logs beyond this are tail-trimmed; a paste has to stay pasteable. */
const MAX_LOG_CHARS = 40_000
const MAX_WORKFLOW_CHARS = 20_000

/** Live CRDT internals, read from the follower at the moment Copy is pressed. */
export interface CrdtDebugSnapshot {
  status: AgentCrdtStatus
  tabId: string | null
  lastSeq: number | null
  schemaError: string | null
  meta: Readonly<Record<string, unknown>>
  nodeIds: readonly string[]
  linkIds: readonly string[]
  appliedOpIds: readonly string[]
  stamps: Readonly<Record<string, unknown>>
}

export interface CrdtDebugReportInput {
  crdt: CrdtDebugSnapshot
  events: readonly DevEvent[]
  /** Whatever the tester typed into "what did you expect instead?". */
  testerNote?: string
  /** Merge-lab results the tester was looking at, if any. */
  mergeTrace?: readonly MergeTraceEntry[]
  /** Serialized active workflow, when the caller can supply one. */
  workflow?: unknown
}

/**
 * Read every CRDT-observable fact out of a follower doc.
 *
 * Uses the package's read-only snapshot surface rather than the live Y types:
 * those accessors never materialize a root on an empty document and never hand
 * back a writable handle, so building a report can never perturb the thing it
 * is reporting on.
 */
export function readCrdtSnapshot(
  doc: Y.Doc | null,
  base: Omit<
    CrdtDebugSnapshot,
    'meta' | 'nodeIds' | 'linkIds' | 'appliedOpIds' | 'stamps'
  >
): CrdtDebugSnapshot {
  if (doc === null) {
    return {
      ...base,
      meta: {},
      nodeIds: [],
      linkIds: [],
      appliedOpIds: [],
      stamps: {}
    }
  }
  try {
    const graph = readGraph(doc)
    return {
      ...base,
      meta: readMeta(doc),
      nodeIds: Object.keys(graph.nodes),
      linkIds: Object.keys(graph.links),
      appliedOpIds: appliedOpIds(doc),
      stamps: readStamps(doc)
    }
  } catch (error) {
    // A doc this build cannot read (KA-11) still has to produce a report —
    // that failure IS the bug being reported.
    return {
      ...base,
      schemaError: base.schemaError ?? String(error),
      meta: {},
      nodeIds: [],
      linkIds: [],
      appliedOpIds: [],
      stamps: {}
    }
  }
}

async function attempt<T>(label: string, load: () => Promise<T>) {
  try {
    return { label, ok: true as const, value: await load() }
  } catch (error) {
    return { label, ok: false as const, error: String(error) }
  }
}

function fence(language: string, body: string): string {
  return ['```' + language, body, '```'].join('\n')
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value, devEventReplacer(), 2)
  } catch (error) {
    return `<unserializable: ${String(error)}>`
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `…(${text.length - max} earlier characters trimmed)…\n${text.slice(-max)}`
}

type SystemStats = Awaited<ReturnType<typeof api.getSystemStats>>

function systemSection(stats: SystemStats): string {
  const lines = [
    `- **ComfyUI version:** ${stats.system.comfyui_version}`,
    `- **OS:** ${stats.system.os}`,
    `- **Python:** ${stats.system.python_version}`,
    `- **Embedded Python:** ${stats.system.embedded_python}`,
    `- **PyTorch:** ${stats.system.pytorch_version}`,
    `- **Arguments:** ${stats.system.argv.join(' ')}`,
    `- **RAM:** ${stats.system.ram_free} free / ${stats.system.ram_total} total`
  ]
  if (stats.system.cloud_version)
    lines.push(`- **Cloud version:** ${stats.system.cloud_version}`)
  if (stats.system.comfyui_frontend_version)
    lines.push(
      `- **Frontend (reported by backend):** ${stats.system.comfyui_frontend_version}`
    )
  for (const device of stats.devices) {
    lines.push(
      `- **Device ${device.index}:** ${device.name} (${device.type}) — VRAM ${device.vram_free} free / ${device.vram_total} total, torch ${device.torch_vram_free} / ${device.torch_vram_total}`
    )
  }
  return lines.join('\n')
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

  const [stats, logs, settings] = await Promise.all([
    attempt('System stats', () => api.getSystemStats()),
    attempt('Server logs', () => api.getLogs()),
    attempt('Settings', () => api.getSettings())
  ])

  const sections: string[] = [
    '# ComfyUI Agent — CRDT debug report',
    `Generated ${new Date().toISOString()}`
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
      `- **Distribution:** ${isCloud ? 'cloud' : 'local/desktop'}`,
      `- **API base:** ${api.apiURL('')}`,
      `- **User agent:** ${navigator.userAgent}`,
      `- **Viewport:** ${window.innerWidth}×${window.innerHeight}`,
      `- **Extensions (${extensionNames.length}):** ${extensionNames.join(', ') || 'none'}`
    ].join('\n')
  )

  sections.push(
    '## System',
    stats.ok
      ? systemSection(stats.value)
      : `_${stats.label} unavailable: ${stats.error}_`
  )

  sections.push('## CRDT event log', fence('json', json(input.events)))

  sections.push(
    '## Document stamps (LWW ledger)',
    fence('json', json(input.crdt.stamps))
  )

  if (input.workflow !== undefined) {
    const serialized = json(input.workflow)
    sections.push(
      '## Workflow',
      'Check for sensitive values (API keys, prompts) before sharing.',
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
    settings.ok
      ? fence('json', json(settings.value))
      : `_${settings.label} unavailable: ${settings.error}_`
  )

  sections.push(
    '## Server logs',
    logs.ok
      ? fence('text', truncate(String(logs.value), MAX_LOG_CHARS))
      : `_${logs.label} unavailable: ${logs.error}_`
  )

  return sections.join('\n\n')
}
