<template>
  <WidgetLayoutField
    :widget
    :input-id
    :value-text="selection.summary"
    :root-class="cn(!disabled && 'cursor-pointer')"
  >
    <template #leading>
      <Button
        type="button"
        tabindex="-1"
        :aria-label="`${widgetLabel}: ${$t('g.previous')}`"
        :disabled="isStepDisabled(-1)"
        class="h-full w-6 shrink-0 rounded-none"
        variant="muted-textonly"
        size="icon-sm"
        @click="stepOption(-1)"
      >
        <i class="icon-[lucide--chevron-left]" aria-hidden="true" />
      </Button>
    </template>
    <template #between><slot name="between" /></template>
    <ComboboxRoot
      ref="combobox"
      :open="isOpen"
      :model-value="selection.option ?? null"
      by="key"
      :disabled
      ignore-filter
      selection-behavior="replace"
      :reset-search-term-on-select="false"
      @update:model-value="selectOption"
      @update:open="handleOpenChange"
    >
      <ComboboxAnchor as-child>
        <div
          data-capture-wheel="true"
          :class="
            cn(
              WidgetInputBaseClass,
              'flex w-full min-w-0 items-center overflow-hidden not-disabled:bg-transparent',
              useWidgetHeight(),
              disabled && 'opacity-50',
              selection.invalid && 'ring-1 ring-destructive'
            )
          "
        >
          <ComboboxTrigger as-child>
            <Button
              :id="inputId"
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              :aria-controls="listboxId"
              :aria-label="widgetLabel"
              :aria-description="lockedDescription"
              :aria-invalid="selection.invalid || undefined"
              :aria-expanded="isOpen"
              :disabled
              tabindex="0"
              data-testid="widget-select-default-trigger"
              variant="textonly"
              size="sm"
              class="h-full min-w-0 flex-1 overflow-hidden rounded-none p-0 font-normal"
            >
              <span class="min-w-[4ch] flex-1 truncate px-2 text-right">
                {{ displayValue }}
              </span>
              <i
                v-if="lockedDirectory"
                class="mr-1 icon-[lucide--lock] text-muted-foreground"
                aria-hidden="true"
              />
            </Button>
          </ComboboxTrigger>
          <slot />
          <Button
            type="button"
            tabindex="-1"
            :aria-label="`${widgetLabel}: ${$t('g.next')}`"
            :disabled="isStepDisabled(1)"
            class="h-full w-6 shrink-0 rounded-none"
            variant="muted-textonly"
            size="icon-sm"
            @click="stepOption(1)"
          >
            <i class="icon-[lucide--chevron-right]" aria-hidden="true" />
          </Button>
        </div>
      </ComboboxAnchor>

      <ComboboxPortal :key="Number(isOpen)">
        <ComboboxContent
          data-capture-wheel="true"
          data-testid="widget-select-default-overlay"
          role="presentation"
          :aria-orientation="undefined"
          :aria-multiselectable="undefined"
          position="popper"
          :side-offset="1"
          align="end"
          prioritize-position
          sticky="always"
          :collision-padding="8"
          :class="
            cn(
              'z-overlay overflow-hidden rounded-lg border border-solid border-border bg-background p-0 shadow-md',
              'max-w-(--reka-combobox-content-available-width) min-w-[min(var(--reka-combobox-trigger-width),var(--reka-combobox-content-available-width))]'
            )
          "
          @keydown.capture="replayComboboxNavigation"
          @keydown.escape.stop="handleOpenChange(false)"
          @focus-outside="handleFocusOutside"
        >
          <div
            v-if="showFolderHeader"
            class="flex min-w-0 items-center gap-2 border-b border-border px-2 py-1 text-xs"
          >
            <span
              class="min-w-0 flex-1 truncate text-muted-foreground"
              :title="folderPath"
              >{{ folderPath }}</span
            >
            <Button
              type="button"
              variant="muted-textonly"
              :disabled="!canLockDirectory"
              :aria-label="lockLabel"
              :aria-pressed="Boolean(lockedDirectory)"
              :tooltip="lockLabel"
              class="size-8 shrink-0 p-0 aria-pressed:bg-secondary aria-pressed:text-foreground"
              @keydown.stop
              @keydown.escape="handleOpenChange(false)"
              @click="toggleFolderLock"
            >
              <i :class="lockIcon" aria-hidden="true" />
            </Button>
          </div>
          <div
            v-if="isFilterable"
            ref="searchInputContainerRef"
            class="m-1 flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors focus-within:border-primary"
          >
            <i
              class="icon-[lucide--search] text-sm text-muted-foreground"
              aria-hidden="true"
            />
            <ComboboxInput
              v-model="searchQuery"
              :placeholder="filterPlaceholder"
              auto-focus
              :aria-label="$t('g.search')"
              :aria-controls="listboxId"
              :aria-activedescendant="activeDescendant"
              data-testid="widget-select-default-search-input"
              class="w-full border-none bg-transparent text-xs outline-none"
            />
          </div>

          <div
            :id="listboxId"
            data-testid="widget-select-default-viewport"
            role="listbox"
            :aria-label="widgetLabel"
            :class="
              cn(
                'max-h-[min(30.5rem,max(2rem,calc(var(--reka-combobox-content-available-height,100dvh)-3rem)))] min-w-full scrollbar-thin scrollbar-thumb-smoke-500/50 scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto p-1 text-xs',
                showFolderHeader &&
                  'max-h-[min(30.5rem,max(2rem,calc(var(--reka-combobox-content-available-height,100dvh)-5.5rem)))]'
              )
            "
            @pointerdown.capture.self="handleViewportPointerDown"
          >
            <div
              aria-hidden="true"
              class="invisible flex h-0 gap-3 overflow-hidden px-2"
            >
              <span class="whitespace-nowrap">{{ longestLabel }}</span>
              <span class="size-3.5 shrink-0" />
            </div>
            <ComboboxVirtualizer
              :key="`${directory.join('/')}:${searchQuery}`"
              v-slot="{ option }"
              :options="browseOptions"
              :estimate-size="32"
              :text-content="(option) => option.label"
            >
              <ComboboxItem
                :value="option"
                :text-value="option.label"
                :aria-label="accessibleOptionLabel(option)"
                class="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-sm p-2 outline-none select-none hover:bg-secondary data-highlighted:bg-secondary data-[state=checked]:bg-primary/20 data-[state=checked]:hover:bg-primary/20 data-[state=checked]:data-highlighted:bg-primary/30"
                @select="handleOptionSelect($event, option)"
              >
                <i
                  v-if="option.kind !== 'value'"
                  :class="
                    cn(
                      'text-muted-foreground',
                      option.kind === 'back'
                        ? 'icon-[lucide--arrow-left]'
                        : 'icon-[lucide--folder]'
                    )
                  "
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                <i
                  v-if="option.kind === 'folder'"
                  class="icon-[lucide--chevron-right] text-muted-foreground"
                  aria-hidden="true"
                />
                <ComboboxItemIndicator
                  class="flex shrink-0 items-center justify-center"
                >
                  <i
                    class="icon-[lucide--check] size-3.5 text-foreground"
                    aria-hidden="true"
                  />
                </ComboboxItemIndicator>
              </ComboboxItem>
            </ComboboxVirtualizer>
          </div>
          <div
            v-if="browseOptions.length === 0"
            role="status"
            aria-live="polite"
            class="p-2 text-xs text-muted-foreground"
          >
            {{ $t('g.noResultsFound') }}
          </div>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import {
  ComboboxPortal,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxVirtualizer
} from 'reka-ui'
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  resolveComboValues,
  useComboOptions
} from '@/renderer/extensions/vueNodes/widgets/composables/useComboOptions'
import type { ComboItem } from '@/renderer/extensions/vueNodes/widgets/composables/useComboOptions'
import { useRestoreFocusOnViewportPointer } from '@/renderer/extensions/vueNodes/widgets/composables/useRestoreFocusOnViewportPointer'
import { replayComboboxNavigation } from '@/renderer/extensions/vueNodes/widgets/utils/replayComboboxNavigation'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { useWidgetHeight } from '@/types/widgetTypes'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  widgetId?: WidgetId
  filenameSummary?: boolean
}

type SelectWidgetOptions = NonNullable<Props['widget']['options']> & {
  filterPlaceholder?: string
}

const { widget, widgetId, filenameSummary = false } = defineProps<Props>()
const { t } = useI18n()
const inputId = useId()
const widgetLabel = computed(() => widget.label || widget.name)
const listboxId = useId()

const modelValue = defineModel<WidgetValue>({
  default(modelProps: Record<string, unknown>) {
    const modelWidget = modelProps.widget as Props['widget'] | undefined
    return resolveComboValues(modelWidget?.options?.values)[0] ?? ''
  }
})

const localFolderLock = ref<string[]>()
const widgetValueStore = useWidgetValueStore()
const lockedDirectory = computed(() =>
  widgetId
    ? widgetValueStore.getWidgetFolderLock(widgetId)?.directory
    : localFolderLock.value
)
const combobox = useTemplateRef('combobox')
const isOpen = ref(false)
const searchInputContainerRef = ref<HTMLElement>()
const { handleFocusOutside, handleViewportPointerDown } =
  useRestoreFocusOnViewportPointer(focusSearchInput)

const widgetOptions = computed(
  () => widget.options as SelectWidgetOptions | undefined
)

const {
  searchQuery,
  directory,
  dynamicOptions,
  hasFolders,
  isFilterable,
  selection,
  longestLabel,
  adjacentOptions,
  openingDirectory,
  browseOptions,
  refreshOptions
} = useComboOptions(() => widgetOptions.value, modelValue, {
  filenameSummary: () => filenameSummary,
  lockedDirectory
})
const disabled = computed(() => Boolean(widgetOptions.value?.disabled))
const placeholder = computed(() => widgetOptions.value?.placeholder ?? '')
const filterPlaceholder = computed(
  () => widgetOptions.value?.filterPlaceholder ?? placeholder.value
)

const folderPath = computed(
  () =>
    (lockedDirectory.value ?? directory.value).join(' / ') ||
    t('widgets.allFolders')
)
const lockIcon = computed(() =>
  lockedDirectory.value ? 'icon-[lucide--lock]' : 'icon-[lucide--lock-open]'
)
const showFolderHeader = computed(
  () => hasFolders.value || Boolean(lockedDirectory.value)
)
const canLockDirectory = computed(
  () => Boolean(lockedDirectory.value) || directory.value.length > 0
)
const lockedDescription = computed(() =>
  lockedDirectory.value
    ? t(
        'widgets.folderLocked',
        { name: lockedDirectory.value.join(' / ') },
        { escapeParameter: false }
      )
    : undefined
)
const displayValue = computed(
  () => selection.value.summary || placeholder.value || '\u00a0'
)
const lockLabel = computed(() =>
  lockedDirectory.value
    ? t(
        'widgets.unlockFolder',
        { name: folderPath.value },
        { escapeParameter: false }
      )
    : directory.value.length
      ? t(
          'widgets.lockFolder',
          { name: folderPath.value },
          { escapeParameter: false }
        )
      : t('widgets.browseToLockFolder')
)

async function toggleFolderLock() {
  const path = lockedDirectory.value ? undefined : [...directory.value]
  if (widgetId) {
    widgetValueStore.setWidgetFolderLock(
      widgetId,
      path ? { directory: path } : undefined
    )
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  } else {
    localFolderLock.value = path
  }
  await nextTick()
  focusSearchInput()
}

const activeDescendant = computed((): string | undefined =>
  browseOptions.value.length
    ? combobox.value?.highlightedElement?.id
    : undefined
)

function accessibleOptionLabel(option: ComboItem) {
  if (option.kind === 'value') return option.label
  return t(
    option.kind === 'folder'
      ? 'widgets.selectFolder'
      : 'widgets.backFromFolder',
    { name: option.label },
    { escapeParameter: false }
  )
}

async function handleOptionSelect(event: Event, option: ComboItem) {
  if (option.kind === 'value') return
  event.preventDefault()
  directory.value = option.directory
  await nextTick()
  focusSearchInput()
  combobox.value?.highlightFirstItem?.()
}

function selectOption(option: ComboItem | null) {
  if (!option || option.kind !== 'value') return

  modelValue.value = option.rawValue
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  searchQuery.value = ''
  isOpen.value = false
}

function isStepDisabled(direction: -1 | 1) {
  return (
    disabled.value ||
    (!dynamicOptions.value && !adjacentOptions.value[direction])
  )
}

function stepOption(direction: -1 | 1) {
  refreshOptions()
  const option = adjacentOptions.value[direction]
  if (option) selectOption(option)
}

function focusSearchInput() {
  const input =
    searchInputContainerRef.value?.querySelector<HTMLInputElement>('input')
  if (!input) return false

  input.focus({ preventScroll: true })
  return true
}

function handleOpenChange(open: boolean) {
  isOpen.value = open

  if (open) {
    refreshOptions()
    directory.value = openingDirectory.value
  } else {
    searchQuery.value = ''
  }
}
</script>
