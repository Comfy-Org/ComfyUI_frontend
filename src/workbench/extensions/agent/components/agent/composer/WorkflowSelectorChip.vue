<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ActiveTab } from '../../../types/activeTab'

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
const workflowTooltipText = computed(() =>
  current.value
    ? t('agent.changeWorkflowForChat')
    : t('agent.chooseWorkflowForChat')
)
const workflowTooltipOpen = ref(false)
const workflowTrigger = ref<HTMLButtonElement>()
const workflowTooltipClass =
  'z-1700 w-max whitespace-nowrap rounded-lg bg-[#171717] px-3 py-1.5 font-inter text-xs leading-4 text-[#fafafa] shadow-none ring-1 ring-inset ring-charcoal-200'

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
  <TooltipProvider :delay-duration="300">
    <div class="flex w-full items-center justify-between gap-1.5">
      <DropdownMenuRoot v-model:open="open">
        <DropdownMenuTrigger as-child>
          <button
            ref="workflowTrigger"
            type="button"
            :aria-label="t('agent.switchWorkflow')"
            :class="
              cn(
                'group text-agent-fg hover:bg-agent-surface-hover inline-flex h-7 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs/4 font-medium transition-colors',
                !current && 'text-agent-fg-muted hover:text-agent-fg'
              )
            "
            @pointerenter="workflowTooltipOpen = true"
            @pointerleave="workflowTooltipOpen = false"
            @focus="workflowTooltipOpen = true"
            @blur="workflowTooltipOpen = false"
            @click="workflowTooltipOpen = false"
          >
            <span
              data-testid="workflow-selector-icon"
              class="text-agent-fg-subtle group-hover:text-agent-fg icon-[lucide--workflow] size-3.5 shrink-0"
            />
            <span class="max-w-40 truncate">{{
              current?.name ?? t('agent.chooseWorkflow')
            }}</span>
            <span
              v-if="current?.modified"
              data-testid="unsaved-dot"
              class="flex size-3.5 shrink-0 items-center justify-center"
            >
              <span class="bg-agent-fg size-[7px] rounded-full" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <TooltipRoot v-model:open="workflowTooltipOpen">
          <TooltipTrigger
            :reference="workflowTrigger"
            as="span"
            aria-hidden="true"
            class="hidden"
          />
          <TooltipPortal>
            <TooltipContent
              side="top"
              align="start"
              :side-offset="6"
              :collision-padding="8"
              :class="workflowTooltipClass"
            >
              {{ workflowTooltipText }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
        <DropdownMenuPortal>
          <DropdownMenuContent
            side="top"
            align="start"
            :side-offset="4"
            class="agent-scope bg-agent-surface-raised z-1100 box-border max-h-64 w-[372px] overflow-y-auto rounded-[10px] border border-white/10 p-1 font-inter shadow-lg"
          >
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              :placeholder="t('agent.searchWorkflows')"
              class="text-agent-fg placeholder:text-agent-fg-muted mb-1 h-8 w-full rounded-[10px] border border-white/15 bg-transparent px-2.5 py-1 text-[14px]/5 outline-none"
              @keydown="onSearchKeydown"
            />
            <DropdownMenuRadioGroup :model-value="current?.path ?? ''">
              <DropdownMenuRadioItem
                v-for="tab in filteredTabs"
                :key="tab.path"
                :value="tab.path"
                class="text-agent-fg box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none data-highlighted:bg-[#404040]"
                @select="emit('selectTab', tab.path)"
              >
                <span
                  v-if="tabActivity.editingTabPath === tab.path"
                  role="img"
                  :aria-label="t('g.agentWorking')"
                  class="text-agent-fg-subtle icon-[lucide--loader-circle] size-4 shrink-0 motion-safe:animate-spin"
                />
                <span
                  v-else
                  class="text-agent-fg-subtle icon-[lucide--folder-closed] size-4 shrink-0"
                />
                <span class="truncate">{{ tab.name }}</span>
                <span
                  v-if="
                    tabActivity.unseenModifiedPaths.has(tab.path) ||
                    tab.modified ||
                    tab.path === current?.path
                  "
                  class="ml-auto flex shrink-0 items-center gap-1.5"
                >
                  <span
                    v-if="tabActivity.unseenModifiedPaths.has(tab.path)"
                    role="img"
                    :aria-label="t('g.agentModified')"
                    class="flex size-4 items-center justify-center"
                  >
                    <span class="size-2 rounded-full bg-primary-background" />
                  </span>
                  <span
                    v-else-if="tab.modified"
                    data-testid="unsaved-dot"
                    class="flex size-4 shrink-0 items-center justify-center"
                  >
                    <span class="bg-agent-fg size-2 rounded-full" />
                  </span>
                  <span
                    class="flex size-4 shrink-0 items-center justify-center"
                  >
                    <DropdownMenuItemIndicator
                      class="flex size-4 items-center justify-center"
                    >
                      <span class="icon-[lucide--check] size-4" />
                    </DropdownMenuItemIndicator>
                  </span>
                </span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <TooltipRoot v-if="current" disable-closing-trigger>
        <TooltipTrigger as-child>
          <button
            type="button"
            :aria-label="t('agent.dontWorkInWorkflow')"
            class="text-agent-fg-subtle hover:bg-agent-surface-hover hover:text-agent-fg flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
            @click="emit('clear')"
          >
            <span class="icon-[lucide--x] size-4" />
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side="top"
            align="end"
            :side-offset="6"
            :collision-padding="8"
            :class="workflowTooltipClass"
          >
            {{ t('agent.dontWorkInWorkflow') }}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </div>
  </TooltipProvider>
</template>
