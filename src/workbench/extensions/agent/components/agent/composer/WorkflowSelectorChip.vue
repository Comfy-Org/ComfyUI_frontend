<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ActiveTab } from '../../../types/activeTab'
import WorkflowTabSection from './WorkflowTabSection.vue'

const {
  activeTab,
  tabs,
  visibleTabPath = null,
  selectingTabPath = null,
  selectTab = async () => false,
  detached = false,
  disabled = false
} = defineProps<{
  activeTab: ActiveTab | null
  tabs: ActiveTab[]
  visibleTabPath?: string | null
  selectingTabPath?: string | null
  selectTab?: (path: string) => Promise<boolean>
  detached?: boolean
  disabled?: boolean
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
const searchInput = ref<InstanceType<typeof Input>>()
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

function openPicker(): void {
  if (!disabled) open.value = true
}

defineExpose({ openPicker })

function onOpenChange(value: boolean): void {
  if (selectingTabPath === null) open.value = value
}

async function onSelectTab(path: string): Promise<void> {
  if (disabled || selectingTabPath !== null) return
  if (await selectTab(path)) open.value = false
}

const tabSections = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const filteredTabs = tabs.filter((tab) =>
    tab.name.toLowerCase().includes(normalizedQuery)
  )
  const visibleTab = filteredTabs.find((tab) => tab.path === visibleTabPath)
  const otherTabs = filteredTabs.filter((tab) => tab.path !== visibleTabPath)

  return [
    {
      key: 'current',
      label: t('agent.currentTab'),
      tabs: visibleTab ? [visibleTab] : []
    },
    {
      key: 'other',
      label: visibleTab ? t('agent.otherOpenWorkflows') : undefined,
      tabs: otherTabs
    }
  ].filter((section) => section.tabs.length > 0)
})

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
    <DropdownMenuRoot :open @update:open="onOpenChange">
      <DropdownMenuTrigger as-child>
        <Tooltip
          :config="workflowTooltipText"
          side="top"
          align="start"
          :delay-duration="300"
          :ignore-non-keyboard-focus="false"
          :disable-closing-trigger="false"
          :collision-padding="8"
        >
          <Button
            type="button"
            :variant="current ? 'textonly' : 'outline'"
            size="unset"
            :disabled
            :aria-label="t('agent.switchWorkflow')"
            :class="
              cn(
                'group h-7 min-w-0 gap-2 px-2.5 text-xs/4 font-normal',
                current && 'flex-1'
              )
            "
          >
            <span
              v-if="tabActivity.editingTabPath === current?.path"
              role="img"
              :aria-label="t('g.agentWorking')"
              class="icon-[lucide--loader-circle] size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
            />
            <span
              v-else
              data-testid="workflow-selector-icon"
              class="icon-[comfy--workflow] size-4 shrink-0 text-muted-foreground group-hover:text-base-foreground"
            />
            <span class="min-w-0 truncate">{{
              current?.name ?? t('agent.selectWorkflowForAgent')
            }}</span>
            <span
              v-if="current?.isPersisted === false || current?.modified"
              data-testid="unsaved-dot"
              class="flex size-3.5 shrink-0 items-center justify-center"
            >
              <span class="size-[7px] rounded-full bg-base-foreground" />
            </span>
          </Button>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          align="start"
          :side-offset="8"
          :reference="composerReference"
          class="agent-scope z-1100 box-border w-(--reka-dropdown-menu-trigger-width) overflow-hidden rounded-lg border border-border-subtle bg-secondary-background p-1 font-inter shadow-lg"
        >
          <Input
            ref="searchInput"
            v-model="query"
            :disabled="selectingTabPath !== null"
            type="text"
            :placeholder="t('agent.searchWorkflows')"
            class="mb-1 h-8 bg-base-background px-2.5 py-1"
            @keydown="onSearchKeydown"
          />
          <DropdownMenuRadioGroup
            :model-value="current?.path ?? ''"
            class="max-h-52 overflow-y-auto"
            @update:model-value="onSelectTab"
          >
            <WorkflowTabSection
              v-for="section in tabSections"
              :key="section.key"
              :label="section.label"
              :tabs="section.tabs"
              :selecting-tab-path
              :disabled
            />
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
