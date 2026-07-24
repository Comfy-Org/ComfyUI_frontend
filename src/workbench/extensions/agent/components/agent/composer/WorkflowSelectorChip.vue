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
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ActiveTab } from '../ActiveTabStrip.vue'

const {
  activeTab,
  tabs,
  detached = false
} = defineProps<{
  activeTab: ActiveTab | null
  tabs: ActiveTab[]
  detached?: boolean
}>()
const emit = defineEmits<{
  selectTab: [path: string]
  clear: []
}>()

const { t } = useI18n()
const tabActivity = useWorkflowTabActivityStore()

const current = computed(() => (detached ? null : activeTab))

const open = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement>()

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  await nextTick()
  searchInput.value?.focus()
})

const filteredTabs = computed(() =>
  tabs.filter((tab) =>
    tab.name.toLowerCase().includes(query.value.trim().toLowerCase())
  )
)

// Suppress keys from the dropdown's typeahead while typing in the search box,
// but let Escape bubble to reka's dismiss (a window keydown listener) so the
// menu still closes from the focused input.
function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') event.stopPropagation()
}
</script>

<template>
  <div class="flex w-full items-center justify-between gap-1.5">
    <DropdownMenuRoot v-model:open="open">
      <DropdownMenuTrigger
        v-tooltip.bottom="{
          value: current
            ? t('agent.changeWorkflowForChat')
            : t('agent.selectWorkflowToGenerate'),
          showDelay: 500
        }"
        :aria-label="t('agent.switchWorkflow')"
        class="rounded-agent bg-agent-pill text-agent-fg hover:bg-agent-surface-hover inline-flex min-w-0 cursor-pointer items-center gap-1.5 px-2 py-1 text-xs transition-colors"
      >
        <span
          class="text-agent-fg-subtle icon-[lucide--panels-top-left] size-3.5 shrink-0"
        />
        <span class="max-w-40 truncate">{{
          current?.name ?? t('agent.chooseWorkflow')
        }}</span>
        <span
          v-if="current?.modified"
          data-testid="unsaved-dot"
          class="bg-agent-fg size-1.5 shrink-0 rounded-full"
        />
        <span class="icon-[lucide--chevron-down] size-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          align="start"
          :side-offset="4"
          class="rounded-agent border-agent-border bg-agent-surface-raised z-1100 max-h-64 w-64 overflow-y-auto border p-1 shadow-lg"
        >
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            :placeholder="t('agent.searchWorkflows')"
            class="border-agent-border bg-agent-surface text-agent-fg placeholder:text-agent-fg-subtle mb-1 w-full rounded-sm border px-2 py-1 text-xs outline-none"
            @keydown="onSearchKeydown"
          />
          <DropdownMenuRadioGroup :model-value="current?.path ?? ''">
            <DropdownMenuRadioItem
              v-for="tab in filteredTabs"
              :key="tab.path"
              :value="tab.path"
              class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
              @select="emit('selectTab', tab.path)"
            >
              <span
                v-if="tabActivity.editingTabPath === tab.path"
                role="img"
                :aria-label="t('g.agentWorking')"
                class="text-agent-fg-subtle icon-[lucide--loader-circle] size-3.5 shrink-0 motion-safe:animate-spin"
              />
              <span
                v-else
                class="text-agent-fg-subtle icon-[lucide--panels-top-left] size-3.5 shrink-0"
              />
              <span class="truncate">{{ tab.name }}</span>
              <span class="ml-auto flex shrink-0 items-center gap-1.5">
                <span
                  v-if="tabActivity.unseenModifiedPaths.has(tab.path)"
                  role="img"
                  :aria-label="t('g.agentModified')"
                  class="size-1.5 rounded-full bg-primary-background"
                />
                <span
                  v-else-if="tab.modified"
                  data-testid="unsaved-dot"
                  class="bg-agent-fg size-1.5 rounded-full"
                />
                <DropdownMenuItemIndicator>
                  <span class="icon-[lucide--check] size-3.5" />
                </DropdownMenuItemIndicator>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <button
      v-if="current"
      v-tooltip.bottom="{
        value: t('agent.dontWorkInWorkflow'),
        showDelay: 500
      }"
      type="button"
      :aria-label="t('agent.dontWorkInWorkflow')"
      class="text-agent-fg-subtle hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
      @click="emit('clear')"
    >
      <span class="icon-[lucide--x] size-3.5" />
    </button>
  </div>
</template>
