<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import type { SidebarSection } from '@/workbench/extensions/agent/stores/agent/agentSidebarLayout'

const { section, compact = false } = defineProps<{
  section: SidebarSection
  compact?: boolean
}>()

const emit = defineEmits<{
  section: [section: SidebarSection]
  openTemplates: []
}>()

const { t } = useI18n()

const destinations = computed(
  (): { id: SidebarSection | 'templates'; label: string; icon: string }[] => [
    {
      id: 'chats',
      label: t('agent.sidebar.chats'),
      icon: 'icon-[lucide--message-square]'
    },
    {
      id: 'apps',
      label: t('agent.nav.apps'),
      icon: 'icon-[lucide--panels-top-left]'
    },
    {
      id: 'workflows',
      label: t('agent.nav.workflows'),
      icon: 'icon-[comfy--workflow]'
    },
    {
      id: 'templates',
      label: t('agent.nav.templates'),
      icon: 'icon-[lucide--layout-template]'
    }
  ]
)

function choose(id: SidebarSection | 'templates'): void {
  if (id === 'templates') emit('openTemplates')
  else emit('section', id)
}
</script>

<template>
  <nav
    :aria-label="t('agent.nav.label')"
    :class="cn('flex flex-col', compact ? 'items-center gap-1' : 'gap-0.5')"
  >
    <template v-for="{ id, label, icon } in destinations" :key="id">
      <Button
        v-if="compact"
        :tooltip="label"
        tooltip-side="right"
        type="button"
        variant="muted-textonly"
        size="icon"
        :aria-label="label"
        :aria-current="id === section ? 'page' : undefined"
        :class="cn(id === section && 'bg-secondary text-foreground')"
        @click="choose(id)"
      >
        <span aria-hidden="true" :class="cn(icon, 'size-4')" />
      </Button>
      <Button
        v-else
        type="button"
        variant="muted-textonly"
        size="unset"
        :aria-current="id === section ? 'page' : undefined"
        :class="
          cn(
            'h-8 w-full justify-start gap-2 rounded-sm px-2 text-sm font-normal',
            id === section && 'bg-secondary text-foreground'
          )
        "
        @click="choose(id)"
      >
        <span aria-hidden="true" :class="cn(icon, 'size-4 shrink-0')" />
        <span class="truncate">{{ label }}</span>
      </Button>
    </template>
  </nav>
</template>
