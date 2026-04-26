import { useLocalStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { log } from '../services/logger'

type AgentMessageRole = 'user' | 'assistant' | 'system'

export interface IngestedAsset {
  id: string
  name: string
  path: string
  mime: string
  size: number
  previewUrl?: string
}

interface ToolMessageMeta {
  script: string
  stdout: string
  stderr?: string
  exitCode: number
}

interface AgentMessage {
  id: string
  role: AgentMessageRole
  text: string
  assets?: IngestedAsset[]
  createdAt: number
  /**
   * Present on system messages that record a tool invocation. Lets the
   * renderer fold/unfold individual tool calls by structure instead of
   * re-parsing the synthesized text summary.
   */
  tool?: ToolMessageMeta
}

interface FabPosition {
  x: number
  y: number
}

// Cap persisted history so IndexedDB stays lean across sessions. Tool
// output can get verbose — 300 entries is ~months of casual use.
const MAX_PERSISTED_MESSAGES = 300

export const useAgentStore = defineStore('agent', () => {
  // IndexedDB-backed: survives reloads, larger quota than localStorage,
  // doesn't block the main thread like localStorage sync-writes would.
  const persisted = useIDBKeyval<AgentMessage[]>('Comfy.Agent.Messages', [], {
    shallow: false
  })
  const messages = ref<AgentMessage[]>([...(persisted.data.value ?? [])])

  // Sync in-memory → persisted (truncated to the cap). Deep watch so edits
  // to message text during streaming also flush.
  watch(
    messages,
    (next) => {
      persisted.data.value = next.slice(-MAX_PERSISTED_MESSAGES)
    },
    { deep: true }
  )

  const isOpen = ref(false)
  const isStreaming = ref(false)
  const fabPosition = useLocalStorage<FabPosition>('Comfy.Agent.FabPosition', {
    x: 0,
    y: 0
  })
  const pendingAssets = ref<IngestedAsset[]>([])
  const unreadCount = ref(0)

  const hasMessages = computed(() => messages.value.length > 0)

  function open(): void {
    isOpen.value = true
    unreadCount.value = 0
  }

  function close(): void {
    isOpen.value = false
  }

  function toggle(): void {
    if (isOpen.value) close()
    else open()
  }

  function addMessage(
    msg: Omit<AgentMessage, 'id' | 'createdAt'>
  ): AgentMessage {
    const full: AgentMessage = {
      ...msg,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    }
    messages.value.push(full)
    // Return the reactive proxy view, NOT the plain object we pushed.
    // Vue 3's reactivity wraps array items lazily on read access; mutating
    // `full.text` directly bypasses the proxy's set trap and fails to
    // trigger watchers (the bug that left assistant streaming silently
    // invisible in xterm). Read-through the array index to get the
    // proxy-wrapped reference, so callers' mutations fire reactivity.
    const reactiveItem = messages.value[messages.value.length - 1]
    if (!isOpen.value && msg.role !== 'user') unreadCount.value++
    log({ kind: msg.role, text: msg.text })
    return reactiveItem
  }

  function clearMessages(): void {
    messages.value = []
  }

  function addPendingAsset(asset: IngestedAsset): void {
    pendingAssets.value.push(asset)
  }

  function consumePendingAssets(): IngestedAsset[] {
    const out = pendingAssets.value
    pendingAssets.value = []
    return out
  }

  function removePendingAsset(id: string): void {
    pendingAssets.value = pendingAssets.value.filter((a) => a.id !== id)
  }

  return {
    messages,
    isOpen,
    isStreaming,
    fabPosition,
    pendingAssets,
    unreadCount,
    hasMessages,
    open,
    close,
    toggle,
    addMessage,
    clearMessages,
    addPendingAsset,
    consumePendingAssets,
    removePendingAsset
  }
})
