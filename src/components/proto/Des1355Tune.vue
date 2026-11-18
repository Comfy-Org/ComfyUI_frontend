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

const open = useLocalStorage('proto.des1355.tuneOpen', true)

const COPY = {
  title: 'DES-1355 tune',
  docks: 'Agent docks',
  today: 'Today',
  inside: 'Inside properties',
  agentTop: 'Agent top (inside)',
  fullHeight: 'Full height',
  underRun: 'Under run toolbar',
  maximize: 'Agent maximized',
  panels: 'Panels',
  properties: 'Properties',
  agent: 'Agent',
  sidebar: 'Sidebar',
  left: 'Left',
  right: 'Right',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light'
}
const settings = useSettingStore()
const properties = usePropertiesPanelStore()
const agent = useAgentPanelStore()
const { isOpen: propertiesOpen } = storeToRefs(properties)
const agentOpen = computed(() => agent.isVisible)
const agentMaximized = computed(() => agent.isMaximized)
const side = computed(() => settings.get('Comfy.Sidebar.Location'))

function toggleAgent(): void {
  if (agent.isVisible) agent.close('topbar_button')
  else agent.open()
}
</script>

<template>
  <div
    class="fixed bottom-14 left-14 z-panel w-64 rounded-lg border border-border bg-background text-xs text-foreground shadow-lg"
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
    <div v-if="open" class="flex flex-col gap-3 px-3 pb-3">
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">{{ COPY.docks }}</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            :variant="options.dock === 'today' ? 'inverted' : 'secondary'"
            @click="options = { ...options, dock: 'today' }"
            >{{ COPY.today }}</Button
          >
          <Button
            size="sm"
            :variant="options.dock === 'inside' ? 'inverted' : 'secondary'"
            @click="options = { ...options, dock: 'inside' }"
            >{{ COPY.inside }}</Button
          >
        </div>
      </section>
      <section class="flex flex-col gap-1">
        <span class="text-muted-foreground">{{ COPY.agentTop }}</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            :variant="
              options.agentTop === 'full-height' ? 'inverted' : 'secondary'
            "
            data-option="agentTop:full-height"
            @click="options = { ...options, agentTop: 'full-height' }"
            >{{ COPY.fullHeight }}</Button
          >
          <Button
            size="sm"
            :variant="
              options.agentTop === 'under-run' ? 'inverted' : 'secondary'
            "
            data-option="agentTop:under-run"
            @click="options = { ...options, agentTop: 'under-run' }"
            >{{ COPY.underRun }}</Button
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
