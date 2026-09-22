import type { AgentWsEvent } from '../../schemas/agentApiSchema'

import { STALE_AFTER_MS } from '../../crdt/agentCrdtDocLifecycle'
import type {
  AssistantMessage,
  RunApprovalPart,
  TextPart,
  ThinkingPart,
  ToolPart
} from './agentMessageParts'
import { snapshotMessage } from './agentMessageParts'

export type AgentChatEvent = Extract<
  AgentWsEvent,
  {
    type:
      | 'agent_thinking'
      | 'agent_tool_call'
      | 'agent_message_delta'
      | 'agent_message_done'
      | 'agent_active_tab'
      | 'agent_ask'
      | 'agent_ask_resolved'
  }
>

export interface AgentEventTransport {
  ingest: (event: AgentChatEvent) => void
  settle: () => void
  /**
   * PM-1575: called whenever the bound workflow's CRDT follower applies a
   * fresh doc update, so any tool-call parts this transport held back
   * pending canvas catch-up (see `shouldAwaitCanvasSync` below) can settle to
   * `done`. A no-op when nothing is pending.
   */
  notifyCanvasCaughtUp: () => void
}

export function createAgentEventTransport(
  message: AssistantMessage,
  emit: (m: AssistantMessage) => void,
  /**
   * PM-1575: an `agent_tool_call` frame's own `status` says nothing about
   * whether the effect it describes has actually reached the canvas -- that
   * travels a separate, unrelated CRDT doc_update. When this returns `true`
   * at the moment a tool call reports done, its part's chat-visible `state`
   * is held at `'streaming'` (matching the in-progress icon/label) instead of
   * flipping straight to `'done'`, until `notifyCanvasCaughtUp` is called or
   * `STALE_AFTER_MS` elapses, whichever comes first -- reusing the same
   * bound the CRDT follower's own passive heartbeat uses
   * (`agentCrdtDocLifecycle.ts`), rather than inventing a new one. Defaults
   * to never deferring, so a caller with no canvas to catch up on (or that
   * never wires this up) keeps the immediate-done behavior.
   */
  shouldAwaitCanvasSync: () => boolean = () => false
): AgentEventTransport {
  let openText: TextPart | null = null
  let openThinking: ThinkingPart | null = null
  let openThinkingStartedAt = 0
  const tools = new Map<string, ToolPart>()
  let settled = false
  let lastTabTargetKey: string | undefined
  // Tool parts whose frame reported done but whose displayed state is held at
  // 'streaming' pending canvas catch-up. Each has its own bounded timer so a
  // part that never gets a `notifyCanvasCaughtUp` call still settles.
  const pendingCanvasSync = new Map<ToolPart, ReturnType<typeof setTimeout>>()

  function settlePendingCanvasSync(part: ToolPart): void {
    const timer = pendingCanvasSync.get(part)
    if (timer !== undefined) clearTimeout(timer)
    pendingCanvasSync.delete(part)
    part.state = 'done'
  }

  function notifyCanvasCaughtUp(): void {
    if (pendingCanvasSync.size === 0) return
    for (const part of [...pendingCanvasSync.keys()])
      settlePendingCanvasSync(part)
    emit(snapshotMessage(message))
  }

  function closeOpenText(): void {
    if (openText) {
      openText.state = 'done'
      openText = null
    }
  }

  function openNewText(): TextPart {
    const part: TextPart = { type: 'text', text: '', state: 'streaming' }
    message.parts.push(part)
    openText = part
    return part
  }

  function closeOpenThinking(): void {
    if (openThinking) {
      openThinking.state = 'done'
      const durationMs = Date.now() - openThinkingStartedAt
      if (durationMs > 0) openThinking.durationMs = durationMs
      openThinking = null
    }
  }

  function openNewThinking(): ThinkingPart {
    const part: ThinkingPart = {
      type: 'thinking',
      text: '',
      state: 'streaming'
    }
    message.parts.push(part)
    openThinking = part
    openThinkingStartedAt = Date.now()
    return part
  }

  function ingest(event: AgentChatEvent): void {
    if (settled) return
    switch (event.type) {
      case 'agent_thinking':
        closeOpenText()
        message.thinking = true
        ;(openThinking ?? openNewThinking()).text += event.data.delta
        message.thinkingText = openThinking?.text
        break
      case 'agent_tool_call': {
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        let part = tools.get(event.data.tool_call_id)
        if (!part) {
          part = {
            type: 'tool',
            callId: event.data.tool_call_id,
            name: event.data.tool_name,
            state: 'streaming'
          }
          tools.set(event.data.tool_call_id, part)
          message.parts.push(part)
        }
        part.name = event.data.tool_name
        if (event.data.status !== 'running') {
          part.ok = event.data.status === 'success'
          part.durationMs = event.data.duration_ms
          if (shouldAwaitCanvasSync()) {
            pendingCanvasSync.set(
              part,
              setTimeout(() => {
                settlePendingCanvasSync(part)
                emit(snapshotMessage(message))
              }, STALE_AFTER_MS)
            )
          } else {
            part.state = 'done'
          }
        }
        break
      }
      case 'agent_active_tab': {
        // The agent re-announces the same tab as it keeps working on it, with
        // text and tool calls in between, so the tail of parts is not the test;
        // only a change of tab is worth another link in the transcript.
        const targetKey = `${event.data.workflow_id}\u0000${event.data.node_locator_id ?? ''}`
        if (lastTabTargetKey === targetKey) return
        lastTabTargetKey = targetKey
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        message.parts.push({
          type: 'tabLink',
          workflowId: event.data.workflow_id,
          locatorId: event.data.node_locator_id,
          name: event.data.name
        })
        break
      }
      case 'agent_ask': {
        if (event.data.kind !== 'run_approval') return
        closeOpenText()
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        const part: RunApprovalPart = {
          type: 'runApproval',
          askId: event.data.ask_id,
          workflowId: event.data.context?.workflow_id || undefined,
          workflowName: event.data.context?.workflow_name || undefined
        }
        message.parts.push(part)
        break
      }
      case 'agent_ask_resolved':
        message.parts = message.parts.filter(
          (part) =>
            part.type !== 'runApproval' || part.askId !== event.data.ask_id
        )
        break
      case 'agent_message_delta':
        closeOpenThinking()
        message.thinking = false
        message.thinkingText = undefined
        ;(openText ?? openNewText()).text += event.data.delta
        break
      case 'agent_message_done':
        settle()
        return
    }
    emit(snapshotMessage(message))
  }

  function settle(): void {
    if (settled) return
    settled = true
    closeOpenText()
    closeOpenThinking()
    message.thinking = false
    message.thinkingText = undefined
    message.streaming = false
    emit(snapshotMessage(message))
  }

  return { ingest, settle, notifyCanvasCaughtUp }
}
