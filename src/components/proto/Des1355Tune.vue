<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import { useSettingStore } from '@/platform/settings/settingStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { Des1355Options } from './des1355'
import { options } from './des1355'

const open = useLocalStorage('proto.des1355.tuneOpen', true)
const TITLE = 'DES-1355 tune'

const settings = useSettingStore()
const properties = usePropertiesPanelStore()
const agent = useAgentPanelStore()

interface Choice {
  label: string
  on: boolean
  option?: string
  pick: () => void
}

function optionChoice<K extends keyof Des1355Options>(
  key: K,
  value: Des1355Options[K],
  label: string
): Choice {
  return {
    label,
    on: options.value[key] === value,
    option: `${key}:${value}`,
    pick: () => {
      options.value = { ...options.value, [key]: value }
    }
  }
}

function toggleAgent(): void {
  if (agent.isVisible) agent.close('topbar_button')
  else agent.open()
}

const sections = computed<{ label: string; choices: Choice[] }[]>(() => [
  {
    label: 'Agent docks',
    choices: [
      optionChoice('dock', 'today', 'Today'),
      optionChoice('dock', 'inside', 'Inside properties')
    ]
  },
  {
    label: 'Agent top (inside)',
    choices: [
      optionChoice('agentTop', 'full-height', 'Full height'),
      optionChoice('agentTop', 'under-run', 'Under run toolbar')
    ]
  },
  {
    label: 'Panels',
    choices: [
      {
        label: 'Properties',
        on: properties.isOpen,
        pick: () => properties.togglePanel()
      },
      { label: 'Agent', on: agent.isVisible, pick: toggleAgent },
      {
        label: 'Agent maximized',
        on: agent.isMaximized,
        pick: () => agent.toggleMaximize()
      }
    ]
  },
  {
    label: 'Sidebar',
    choices: [
      { side: 'left', label: 'Left' } as const,
      { side: 'right', label: 'Right' } as const
    ].map(({ side, label }) => ({
      label,
      on: settings.get('Comfy.Sidebar.Location') === side,
      pick: () => void settings.set('Comfy.Sidebar.Location', side)
    }))
  },
  {
    label: 'Theme',
    choices: [
      { id: 'dark', label: 'Dark' },
      { id: 'light', label: 'Light' }
    ].map(({ id, label }) => ({
      label,
      on: false,
      pick: () => void settings.set('Comfy.ColorPalette', id)
    }))
  }
])
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
      {{ TITLE
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
      <section
        v-for="section in sections"
        :key="section.label"
        class="flex flex-col gap-1"
      >
        <span class="text-muted-foreground">{{ section.label }}</span>
        <div class="flex flex-wrap gap-1">
          <Button
            v-for="choice in section.choices"
            :key="choice.label"
            size="sm"
            :variant="choice.on ? 'inverted' : 'secondary'"
            :data-on="choice.on"
            :data-option="choice.option"
            @click="choice.pick()"
            >{{ choice.label }}</Button
          >
        </div>
      </section>
    </div>
  </div>
</template>
