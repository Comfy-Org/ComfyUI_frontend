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
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  AGENT_REKA_TOOLTIP_CONTENT_CLASS,
  AGENT_REKA_TOOLTIP_PROVIDER_PROPS
} from '@/composables/useTooltipConfig'
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

const open = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement>()
const selectorRoot = useTemplateRef<HTMLElement>('selectorRoot')
const composerReference = computed(
  () => selectorRoot.value?.parentElement?.parentElement ?? undefined
)

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
  <div
    ref="selectorRoot"
    class="flex w-full items-center justify-between gap-1.5"
  >
    <DropdownMenuRoot v-model:open="open">
      <TooltipProvider v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
        <TooltipRoot>
          <DropdownMenuTrigger as-child>
            <TooltipTrigger as-child>
              <button
                type="button"
                :aria-label="t('agent.switchWorkflow')"
                :class="
                  cn(
                    'group text-agent-fg hover:bg-agent-surface-hover inline-flex h-7 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs/4 font-medium transition-colors',
                    !current && 'text-agent-fg-muted hover:text-agent-fg flex-1'
                  )
                "
              >
                <span
                  v-if="tabActivity.editingTabPath === current?.path"
                  role="img"
                  :aria-label="t('g.agentWorking')"
                  class="text-agent-fg-subtle icon-[lucide--loader-circle] size-4 shrink-0 motion-safe:animate-spin"
                />
                <span
                  v-else
                  data-testid="workflow-selector-icon"
                  class="text-agent-fg-subtle group-hover:text-agent-fg icon-[comfy--workflow] size-3.5 shrink-0"
                />
                <span
                  class="min-w-0 truncate underline decoration-solid underline-offset-2"
                  >{{
                    current?.name ?? t('agent.selectWorkflowForAgent')
                  }}</span
                >
                <span
                  v-if="current?.isPersisted === false || current?.modified"
                  data-testid="unsaved-dot"
                  class="flex size-3.5 shrink-0 items-center justify-center"
                >
                  <span class="bg-agent-fg size-[7px] rounded-full" />
                </span>
              </button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              align="start"
              :side-offset="6"
              :collision-padding="8"
              :class="AGENT_REKA_TOOLTIP_CONTENT_CLASS"
            >
              {{ workflowTooltipText }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          align="start"
          :side-offset="8"
          :reference="composerReference"
          class="agent-scope bg-agent-surface-raised z-1100 box-border max-h-64 w-(--reka-dropdown-menu-trigger-width) overflow-y-auto rounded-[10px] border border-white/10 p-1 font-inter shadow-lg"
        >
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            :placeholder="t('agent.searchWorkflows')"
            class="text-agent-fg placeholder:text-agent-fg-muted mb-1 h-8 w-full rounded-[10px] border border-white/15 bg-transparent px-2.5 py-1 text-[14px]/5 outline-none"
            @keydown="onSearchKeydown"
          />
          <DropdownMenuRadioGroup
            :model-value="current?.path ?? ''"
            @update:model-value="emit('selectTab', $event)"
          >
            <DropdownMenuRadioItem
              v-for="tab in filteredTabs"
              :key="tab.path"
              :value="tab.path"
              class="text-agent-fg box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none data-highlighted:bg-[#404040]"
            >
              <span
                v-if="tabActivity.editingTabPath === tab.path"
                role="img"
                :aria-label="t('g.agentWorking')"
                class="text-agent-fg-subtle icon-[lucide--loader-circle] size-4 shrink-0 motion-safe:animate-spin"
              />
              <span
                v-else
                class="text-agent-fg-subtle icon-[comfy--workflow] size-4 shrink-0"
              />
              <span class="truncate">{{ tab.name }}</span>
              <span
                v-if="
                  tabActivity.unseenModifiedPaths.has(tab.path) ||
                  tab.isPersisted === false ||
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
                  v-else-if="tab.isPersisted === false || tab.modified"
                  data-testid="unsaved-dot"
                  class="flex size-4 shrink-0 items-center justify-center"
                >
                  <span class="bg-agent-fg size-2 rounded-full" />
                </span>
                <span class="flex size-4 shrink-0 items-center justify-center">
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
    <TooltipProvider v-if="current" v-bind="AGENT_REKA_TOOLTIP_PROVIDER_PROPS">
      <TooltipRoot disable-closing-trigger>
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
            :class="AGENT_REKA_TOOLTIP_CONTENT_CLASS"
          >
            {{ t('agent.dontWorkInWorkflow') }}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  </div>
</template>
