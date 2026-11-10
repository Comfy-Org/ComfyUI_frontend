import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { HistoryGroups } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { ActiveTab } from '@/workbench/extensions/agent/types/activeTab'

export const emptyHistory: HistoryGroups = {
  current: [],
  today: [],
  yesterday: [],
  earlier: []
}

export const portraitTab: ActiveTab = {
  path: 'workflows/portrait.json',
  name: 'portrait'
}

export const panelTabs = [portraitTab]

export function userTurn(id: string, text: string): ConversationEntry {
  return { id: toTurnId(id), role: 'user', text }
}

export function thinkingTurn(
  id: string,
  thinkingText: string
): ConversationEntry {
  return {
    id: toTurnId(id),
    role: 'assistant',
    parts: [],
    streaming: true,
    thinking: true,
    thinkingText
  }
}

export function replyTurn(
  id: string,
  text: string,
  creditsUsed?: number
): ConversationEntry {
  return {
    id: toTurnId(id),
    role: 'assistant',
    parts: [{ type: 'text', text, state: 'done' }],
    streaming: false,
    thinking: false,
    ...(creditsUsed === undefined ? {} : { creditsUsed })
  }
}

export const usingFreeEntries: ConversationEntry[] = [
  userTurn('des1317-free-user', 'Build a portrait upscale workflow'),
  thinkingTurn('des1317-free-assistant', 'Building your workflow…')
]

export const almostGoneEntries: ConversationEntry[] = [
  userTurn('des1317-ending-user', 'Upscale this'),
  thinkingTurn('des1317-ending-assistant', 'Almost out of free credit…')
]

export const paidEntries: ConversationEntry[] = [
  userTurn('des1317-paid-user', 'Upscale this'),
  replyTurn(
    'des1317-paid-assistant',
    'The workflow is ready to run on Comfy Credits.',
    1.27
  )
]
