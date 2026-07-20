<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import type { ActiveTab } from '../ActiveTabStrip.vue'

const { activeTab, tabs } = defineProps<{
  activeTab: ActiveTab | null
  tabs: ActiveTab[]
}>()
const emit = defineEmits<{
  selectTab: [path: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="activeTab" class="flex">
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        :aria-label="t('agent.switchWorkflow')"
        class="rounded-agent bg-agent-pill text-agent-fg hover:bg-agent-surface-hover inline-flex min-w-0 cursor-pointer items-center gap-1.5 px-2 py-1 text-xs transition-colors"
      >
        <span
          class="text-agent-fg-subtle icon-[lucide--panels-top-left] size-3.5 shrink-0"
        />
        <span class="max-w-40 truncate">{{ activeTab.name }}</span>
        <span class="icon-[lucide--chevron-down] size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          align="start"
          :side-offset="4"
          class="rounded-agent border-agent-border bg-agent-surface-raised z-1100 max-h-64 w-64 overflow-y-auto border p-1 shadow-lg"
        >
          <DropdownMenuRadioGroup :model-value="activeTab.path">
            <DropdownMenuRadioItem
              v-for="tab in tabs"
              :key="tab.path"
              :value="tab.path"
              class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
              @select="emit('selectTab', tab.path)"
            >
              <span
                class="text-agent-fg-subtle icon-[lucide--panels-top-left] size-3.5 shrink-0"
              />
              <span class="truncate">{{ tab.name }}</span>
              <DropdownMenuItemIndicator class="ml-auto shrink-0">
                <span class="icon-[lucide--check] size-3.5" />
              </DropdownMenuItemIndicator>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
