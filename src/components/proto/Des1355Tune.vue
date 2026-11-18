<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { useSettingStore } from '@/platform/settings/settingStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { Des1355Options } from './des1355'
import { options } from './des1355'

const open = useLocalStorage('proto.des1355.tuneOpen', true)

const COPY = {
  title: 'DES-1355 tune',
  panels: 'Panels',
  properties: 'Properties',
  agent: 'Agent',
  maximize: 'Agent maximized',
  nodes: 'Nodes sidebar',
  sidebar: 'Sidebar side',
  left: 'Left',
  right: 'Right',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light'
}

type Group<K extends keyof Des1355Options> = {
  key: K
  label: string
  choices: { value: Des1355Options[K]; label: string }[]
}
const GROUPS = [
  {
    key: 'dock',
    label: 'Agent docks',
    choices: [
      { value: 'today', label: 'Today' },
      { value: 'inside', label: 'Inside properties' }
    ]
  },
  {
    key: 'maximize',
    label: 'Maximize (docked inside)',
    choices: [
      { value: 'today', label: 'Today' },
      { value: 'overlay', label: 'Overlay' }
    ]
  },
  {
    key: 'overlayCheck',
    label: 'Overlay check',
    choices: [
      { value: 'today', label: 'Today' },
      { value: 'include-properties', label: 'Include properties' }
    ]
  },
  {
    key: 'issuesCard',
    label: 'Issues card',
    choices: [
      { value: 'today', label: 'Today' },
      { value: 'shift-left', label: 'Shift left' },
      { value: 'below-header', label: 'Below agent header' }
    ]
  }
] as Group<keyof Des1355Options>[]

function set<K extends keyof Des1355Options>(
  key: K,
  value: Des1355Options[K]
): void {
  options.value = { ...options.value, [key]: value }
}

const settings = useSettingStore()
const properties = usePropertiesPanelStore()
const agent = useAgentPanelStore()
const sidebarTabs = useSidebarTabStore()
const { isOpen: propertiesOpen } = storeToRefs(properties)
const agentOpen = computed(() => agent.isVisible)
const agentMaximized = computed(() => agent.isMaximized)
const nodesOpen = computed(
  () => sidebarTabs.activeSidebarTabId === 'node-library'
)
const side = computed(() => settings.get('Comfy.Sidebar.Location'))

function toggleAgent(): void {
  if (agent.isVisible) agent.close('topbar_button')
  else agent.open()
}
</script>

<template>
  <div
    class="fixed bottom-14 left-14 z-panel w-72 rounded-lg border border-border bg-background text-xs text-foreground shadow-lg"
    data-testid="des1355-tune"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between px-3 py-2 font-medium"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ COPY.title
      }}<i
        :class="
          cn(
            'icon-[lucide--chevron-down] text-muted-foreground transition-transform',
            !open && 'rotate-180'
          )
        "
      />
    </button>
    <div
      v-if="open"
      class="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-3 pb-3"
    >
      <section v-for="g in GROUPS" :key="g.key" class="flex flex-col gap-1">
        <span class="text-muted-foreground">{{ g.label }}</span>
        <div class="flex flex-wrap gap-1">
          <Button
            v-for="c in g.choices"
            :key="String(c.value)"
            size="sm"
            :variant="options[g.key] === c.value ? 'inverted' : 'secondary'"
            :aria-pressed="options[g.key] === c.value"
            :data-option="`${g.key}:${c.value}`"
            @click="set(g.key, c.value)"
            >{{ c.label }}</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">{{ COPY.panels }}</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            :variant="propertiesOpen ? 'inverted' : 'secondary'"
            :data-on="propertiesOpen"
            @click="properties.togglePanel()"
            >{{ COPY.properties }}</Button
          >
          <Button
            size="sm"
            :variant="agentOpen ? 'inverted' : 'secondary'"
            :data-on="agentOpen"
            @click="toggleAgent"
            >{{ COPY.agent }}</Button
          >
          <Button
            size="sm"
            :variant="agentMaximized ? 'inverted' : 'secondary'"
            :data-on="agentMaximized"
            @click="agent.toggleMaximize()"
            >{{ COPY.maximize }}</Button
          >
          <Button
            size="sm"
            :variant="nodesOpen ? 'inverted' : 'secondary'"
            :data-on="nodesOpen"
            @click="sidebarTabs.toggleSidebarTab('node-library')"
            >{{ COPY.nodes }}</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">{{ COPY.sidebar }}</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            :variant="side === 'left' ? 'inverted' : 'secondary'"
            @click="settings.set('Comfy.Sidebar.Location', 'left')"
            >{{ COPY.left }}</Button
          >
          <Button
            size="sm"
            :variant="side === 'right' ? 'inverted' : 'secondary'"
            @click="settings.set('Comfy.Sidebar.Location', 'right')"
            >{{ COPY.right }}</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">{{ COPY.theme }}</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            @click="settings.set('Comfy.ColorPalette', 'dark')"
            >{{ COPY.dark }}</Button
          >
          <Button
            size="sm"
            variant="secondary"
            @click="settings.set('Comfy.ColorPalette', 'light')"
            >{{ COPY.light }}</Button
          >
        </div>
      </section>
    </div>
  </div>
</template>
