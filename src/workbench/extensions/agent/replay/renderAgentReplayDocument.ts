import type { AgentReplayBundleV1 } from './agentReplayBundle'

type AgentReplayRenderFidelity = 'panel_only' | 'transcript_only'

export interface AgentReplayDocument {
  fidelity: AgentReplayRenderFidelity
  durationMs: number
  html: string
}

type ReplayEntry = AgentReplayBundleV1['entries'][number]

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function objectString(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[unrenderable value]'
  }
}

function stringField(
  value: Record<string, unknown>,
  field: string
): string | undefined {
  const candidate = value[field]
  return typeof candidate === 'string' ? candidate : undefined
}

function eventBody(event: Record<string, unknown>): string {
  const content = event.content
  if (typeof content === 'object' && content !== null) {
    const text = stringField(content as Record<string, unknown>, 'text')
    if (text !== undefined) return text
  }
  return objectString(content ?? event)
}

function renderVisibleEvent(
  entry: Extract<ReplayEntry, { kind: 'visible_event' }>
): string {
  const type = stringField(entry.event, 'type') ?? 'event'
  const role = stringField(entry.event, 'role')
  const toolName = stringField(entry.event, 'tool_name')
  const title =
    type === 'agent_message'
      ? role === 'user'
        ? 'User'
        : role === 'assistant'
          ? 'Agent'
          : (role ?? 'Message')
      : type === 'agent_tool_call'
        ? `Tool: ${toolName ?? 'unknown'}`
        : type.replaceAll('_', ' ')
  return `<article class="entry visible-event" data-at-ms="${entry.at_ms}"><header><span>${escapeHtml(title)}</span><time>${formatTime(entry.at_ms)}</time></header><pre>${escapeHtml(eventBody(entry.event))}</pre></article>`
}

function renderEntry(entry: ReplayEntry): string {
  if (entry.kind === 'visible_event') return renderVisibleEvent(entry)
  if (entry.kind === 'tool_outcome')
    return `<article class="entry tool-outcome ${entry.status}" data-at-ms="${entry.at_ms}"><header><span>${escapeHtml(entry.tool_name)}</span><time>${formatTime(entry.at_ms)}</time></header><p>${escapeHtml(entry.status)}${entry.summary ? `: ${escapeHtml(entry.summary)}` : ''}</p></article>`
  return `<article class="entry document-frame" data-at-ms="${entry.at_ms}"><header><span>Workflow update</span><time>${formatTime(entry.at_ms)}</time></header><p>${escapeHtml(entry.workflow_id)} · sequence ${entry.seq}</p></article>`
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function classifyFidelity(
  bundle: AgentReplayBundleV1
): AgentReplayRenderFidelity {
  return bundle.workflows.length > 0 ? 'panel_only' : 'transcript_only'
}

function replayStyle(): string {
  return `
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #111318; color: #f4f4f5; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top, #242735 0, #111318 45%); }
    main { width: min(920px, calc(100% - 48px)); margin: 0 auto; padding: 40px 0 64px; }
    .summary { position: sticky; top: 0; z-index: 2; padding: 20px 0; background: linear-gradient(#111318 70%, transparent); }
    .summary h1 { margin: 0 0 8px; font-size: 24px; }
    .summary p { margin: 0; color: #a1a1aa; }
    .fidelity { display: inline-flex; margin-top: 14px; border: 1px solid #52525b; border-radius: 999px; padding: 6px 10px; color: #d4d4d8; font-size: 13px; }
    .timeline { display: grid; gap: 14px; }
    .entry { border: 1px solid #323641; border-radius: 14px; padding: 16px 18px; background: rgba(28, 31, 39, .94); box-shadow: 0 12px 36px rgba(0, 0, 0, .22); }
    .entry[hidden] { display: none; }
    .entry header { display: flex; justify-content: space-between; gap: 16px; color: #d4d4d8; font-weight: 650; }
    .entry time { color: #71717a; font-size: 13px; font-weight: 500; }
    .entry pre { margin: 12px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; color: #fafafa; font: inherit; line-height: 1.55; }
    .entry p { margin: 10px 0 0; color: #d4d4d8; }
    .tool-outcome { border-left: 4px solid #71717a; }
    .tool-outcome.succeeded { border-left-color: #22c55e; }
    .tool-outcome.failed, .tool-outcome.cancelled { border-left-color: #f97316; }
    .document-frame { border-left: 4px solid #8b5cf6; }
  `
}

export function renderAgentReplayDocument(
  bundle: AgentReplayBundleV1
): AgentReplayDocument {
  const fidelity = classifyFidelity(bundle)
  const durationMs = bundle.entries.at(-1)?.at_ms ?? 0
  const reasons = bundle.fidelity.reasons.join(', ')
  const entries = bundle.entries.map(renderEntry).join('')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent replay</title><style>${replayStyle()}</style></head><body><main data-replay-id="${escapeHtml(bundle.replay_id)}" data-fidelity="${fidelity}"><section class="summary"><h1>Agent session replay</h1><p>${escapeHtml(bundle.environment)} · ${bundle.entries.length} events</p><span class="fidelity">${fidelity.replaceAll('_', ' ')}${reasons ? ` · ${escapeHtml(reasons)}` : ''}</span></section><section class="timeline">${entries}</section></main><script>window.setReplayTime=function(ms){document.querySelectorAll('[data-at-ms]').forEach(function(entry){entry.hidden=Number(entry.dataset.atMs)>ms})};window.setReplayTime(0)</script></body></html>`
  return { fidelity, durationMs, html }
}
