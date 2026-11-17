<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { useSettingStore } from '@/platform/settings/settingStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { options } from './des1355'

/**
 * DES-1355 prototype: the tune panel. Dock the agent as today or inside the
 * properties panel; open or close each panel; swap the sidebar side; theme.
 * Explore code: mounted by one line in GraphView.
 */
const open = useLocalStorage('proto.des1355.tuneOpen', true)
const settings = useSettingStore()
const properties = usePropertiesPanelStore()
const agent = useAgentPanelStore()
const { isOpen: propertiesOpen } = storeToRefs(properties)
const agentOpen = computed(() => agent.isVisible)
const side = computed(() => settings.get('Comfy.Sidebar.Location'))

function toggleAgent(): void {
  if (agent.isVisible) agent.close('topbar_button')
  else agent.open()
}
</script>

<template>
  <!-- Explore code (DES-1355 tune panel): not shipped, not translated. -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text, better-tailwindcss/no-restricted-classes -->
  <div
    class="fixed bottom-14 left-14 z-1000 w-64 rounded-lg border border-border bg-background text-xs text-foreground shadow-lg"
    data-testid="des1355-tune"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between px-3 py-2 font-medium"
      :aria-expanded="open"
      @click="open = !open"
    >
      DES-1355 tune
      <i
        :class="
          cn(
            'icon-[lucide--chevron-down] text-muted-foreground transition-transform',
            !open && 'rotate-180'
          )
        "
      />
    </button>
    <div v-if="open" class="flex flex-col gap-3 px-3 pb-3">
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">Agent docks</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            :variant="options.dock === 'today' ? 'inverted' : 'secondary'"
            @click="options = { ...options, dock: 'today' }"
            >Today</Button
          >
          <Button
            size="sm"
            :variant="options.dock === 'inside' ? 'inverted' : 'secondary'"
            @click="options = { ...options, dock: 'inside' }"
            >Inside properties</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">Panels</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            :variant="propertiesOpen ? 'inverted' : 'secondary'"
            :data-on="propertiesOpen"
            @click="properties.togglePanel()"
            >Properties</Button
          >
          <Button
            size="sm"
            :variant="agentOpen ? 'inverted' : 'secondary'"
            :data-on="agentOpen"
            @click="toggleAgent"
            >Agent</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">Sidebar</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            :variant="side === 'left' ? 'inverted' : 'secondary'"
            @click="settings.set('Comfy.Sidebar.Location', 'left')"
            >Left</Button
          >
          <Button
            size="sm"
            :variant="side === 'right' ? 'inverted' : 'secondary'"
            @click="settings.set('Comfy.Sidebar.Location', 'right')"
            >Right</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">Theme</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            @click="settings.set('Comfy.ColorPalette', 'dark')"
            >Dark</Button
          >
          <Button
            size="sm"
            variant="secondary"
            @click="settings.set('Comfy.ColorPalette', 'light')"
            >Light</Button
          >
        </div>
      </section>
    </div>
  </div>
</template>
