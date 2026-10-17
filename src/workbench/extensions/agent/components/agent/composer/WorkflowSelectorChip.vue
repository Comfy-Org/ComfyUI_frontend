<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { DropdownMenuItemIndicator, DropdownMenuRadioGroup } from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuRadioItem from '@/components/ui/menu/MenuRadioItem.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
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
const searchInput = useTemplateRef('searchInput')
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
    <Menu
      :open
      side="top"
      :side-offset="8"
      :reference="composerReference"
      width="trigger"
      class="agent-scope"
      @update:open="onOpenChange"
    >
      <template #trigger>
        <Button
          :tooltip="workflowTooltipText"
          type="button"
          :variant="current ? 'textonly' : 'outline'"
          size="md"
          :disabled
          :aria-label="t('agent.switchWorkflow')"
          :class="
            cn('group min-w-0 justify-start text-left', current && 'flex-1')
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
            class="flex size-4 shrink-0 items-center justify-center"
          >
            <Badge variant="dot" class="bg-base-foreground" />
          </span>
        </Button>
      </template>
      <SearchInput
        ref="searchInput"
        v-model="query"
        :disabled="selectingTabPath !== null"
        :placeholder="t('agent.searchWorkflows')"
        :aria-label="t('agent.searchWorkflows')"
        class="mb-1"
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
            class="px-3 py-1.5 text-xs font-semibold text-muted-foreground"
          >
            {{ section.label }}
          </div>
          <MenuRadioItem
            v-for="tab in section.tabs"
            :key="tab.path"
            :value="tab.path"
            :disabled="disabled || selectingTabPath !== null"
            :aria-busy="selectingTabPath === tab.path || undefined"
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
              <Badge variant="dot" class="bg-primary-background" />
            </span>
            <span
              v-else-if="tab.isPersisted === false || tab.modified"
              data-testid="unsaved-dot"
              class="flex size-4 shrink-0 items-center justify-center"
            >
              <Badge variant="dot" class="bg-base-foreground" />
            </span>
            <span
              class="ml-auto flex size-4 shrink-0 items-center justify-center"
            >
              <DropdownMenuItemIndicator
                class="flex size-4 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  class="icon-[lucide--check] size-3.5"
                />
              </DropdownMenuItemIndicator>
            </span>
          </MenuRadioItem>
        </div>
      </DropdownMenuRadioGroup>
    </Menu>
  </div>
</template>
