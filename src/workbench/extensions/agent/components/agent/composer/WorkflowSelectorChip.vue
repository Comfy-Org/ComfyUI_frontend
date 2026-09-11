<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Input from '@/components/ui/input/Input.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ActiveTab } from '../../../types/activeTab'

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
    <DropdownMenuRoot :open="open" @update:open="onOpenChange">
      <AccessibleTooltip
        :label="workflowTooltipText"
        side="top"
        align="start"
        :skip-delay-duration="0"
        disable-hoverable-content
        :disable-closing-trigger="false"
        :collision-padding="8"
      >
        <template #trigger>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              :disabled="disabled"
              :aria-label="t('agent.switchWorkflow')"
              :class="
                cn(
                  'group inline-flex h-7 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs/4 font-normal text-base-foreground transition-colors hover:bg-secondary-background-hover disabled:cursor-not-allowed disabled:opacity-50',
                  current
                    ? 'flex-1'
                    : 'border border-border-default bg-secondary-background'
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
                class="icon-[comfy--workflow] size-3.5 shrink-0 text-muted-foreground group-hover:text-base-foreground"
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
            </button>
          </DropdownMenuTrigger>
        </template>
      </AccessibleTooltip>
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
            <div
              v-for="section in tabSections"
              :key="section.key"
              role="group"
              :aria-label="section.label"
            >
              <div
                v-if="section.label"
                aria-hidden="true"
                class="px-1.5 py-1 text-[11px]/4 font-medium text-muted-foreground"
              >
                {{ section.label }}
              </div>
              <DropdownMenuRadioItem
                v-for="tab in section.tabs"
                :key="tab.path"
                :value="tab.path"
                :disabled="disabled || selectingTabPath !== null"
                :aria-busy="selectingTabPath === tab.path || undefined"
                class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
                @select.prevent
              >
                <span
                  v-if="selectingTabPath === tab.path"
                  role="status"
                  class="flex size-4 shrink-0 items-center justify-center"
                >
                  <span
                    class="icon-[lucide--loader-circle] size-4 text-muted-foreground motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  <span class="sr-only">{{ t('agent.savingWorkflow') }}</span>
                </span>
                <span
                  v-else-if="tabActivity.editingTabPath === tab.path"
                  role="img"
                  :aria-label="t('g.agentWorking')"
                  class="icon-[lucide--loader-circle] size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
                />
                <span
                  v-else
                  class="icon-[comfy--workflow] size-4 shrink-0 text-muted-foreground"
                />
                <span class="min-w-0 truncate">{{ tab.name }}</span>
                <span
                  v-if="tabActivity.unseenModifiedPaths.has(tab.path)"
                  role="img"
                  :aria-label="t('g.agentModified')"
                  class="flex size-4 shrink-0 items-center justify-center"
                >
                  <span class="size-2 rounded-full bg-primary-background" />
                </span>
                <span
                  v-else-if="tab.isPersisted === false || tab.modified"
                  data-testid="unsaved-dot"
                  class="flex size-4 shrink-0 items-center justify-center"
                >
                  <span class="size-2 rounded-full bg-base-foreground" />
                </span>
                <span
                  class="ml-auto flex size-4 shrink-0 items-center justify-center"
                >
                  <DropdownMenuItemIndicator
                    class="flex size-4 items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      class="icon-[comfy--comfy-c] size-2.5 text-brand-yellow"
                    />
                  </DropdownMenuItemIndicator>
                </span>
              </DropdownMenuRadioItem>
            </div>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
