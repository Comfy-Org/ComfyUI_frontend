<template>
  <Teleport to="body">
    <AgentFab />
    <XtermPanel />
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

import { useAgentStore } from '../stores/agentStore'
import AgentFab from './AgentFab.vue'
import XtermPanel from './XtermPanel.vue'

onMounted(() => {
  const commandStore = useCommandStore()
  const keybindingStore = useKeybindingStore()
  const agentStore = useAgentStore()

  // Register the toggle command idempotently — hot-reload may remount.
  if (!commandStore.isRegistered('Comfy.Agent.Toggle')) {
    commandStore.registerCommand({
      id: 'Comfy.Agent.Toggle',
      label: 'Toggle ComfyAI Agent',
      menubarLabel: 'Toggle ComfyAI',
      icon: 'pi pi-sparkles',
      function: () => {
        agentStore.toggle()
      }
    })
  }

  // Single-key 'c' — matches the single-key style of 'r' (refresh) and
  // 'w' (workflows sidebar). Wrapped in try/catch because addDefaultKeybinding
  // throws on duplicates.
  try {
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.Agent.Toggle',
        combo: { key: 'c' }
      })
    )
  } catch {
    /* already registered */
  }
})
</script>
