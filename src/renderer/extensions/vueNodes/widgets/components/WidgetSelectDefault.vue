<template>
  <WidgetLayoutField
    :widget
    :input-id
    :value-text="selectedSummary"
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
      :model-value="selectedOption ?? null"
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
              isInvalid && 'ring-1 ring-destructive'
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
              :aria-invalid="isInvalid || undefined"
              :aria-expanded="isOpen"
              :disabled
              tabindex="0"
              data-testid="widget-select-default-trigger"
              variant="textonly"
              size="sm"
              class="h-full min-w-0 flex-1 overflow-hidden rounded-none p-0 font-normal"
            >
              <span class="min-w-[4ch] flex-1 truncate px-2 text-right">
                {{ selectedSummary || placeholder || '\u00a0' }}
              </span>
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
            class="min-w-full scrollbar-thin scrollbar-thumb-smoke-500/50 scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto p-1 text-xs"
            :style="viewportStyle"
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
              <WidgetSelectOption
                :option
                @select="handleOptionSelect($event, option)"
              />
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
import { countBy } from 'es-toolkit'
import {
  ComboboxPortal,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxVirtualizer
} from 'reka-ui'
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
import type { CSSProperties } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useComboStepping } from '@/renderer/extensions/vueNodes/widgets/composables/useComboStepping'
import { useRestoreFocusOnViewportPointer } from '@/renderer/extensions/vueNodes/widgets/composables/useRestoreFocusOnViewportPointer'
import { replayComboboxNavigation } from '@/renderer/extensions/vueNodes/widgets/utils/replayComboboxNavigation'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'
import WidgetSelectOption from './WidgetSelectOption.vue'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  filenameSummary?: boolean
}

interface SelectOption {
  kind: 'value'
  key: string
  label: string
  rawValue: NonNullable<WidgetValue>
  value: string
}

interface SelectFolder {
  kind: 'folder' | 'back'
  key: string
  label: string
  directory: string[]
}

type SelectWidgetOptions = NonNullable<Props['widget']['options']> & {
  filterPlaceholder?: string
}

const { widget, filenameSummary = false } = defineProps<Props>()
const inputId = useId()
const widgetLabel = computed(() => widget.label || widget.name)
const listboxId = useId()

function resolveRawValues(values: unknown): unknown[] {
  try {
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved) ? resolved : []
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to resolve options', error)
    return []
  }
}

function toWidgetValue(value: unknown): NonNullable<WidgetValue> {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (typeof value === 'object' && value !== null)
  ) {
    return value
  }

  return String(value)
}

function resolveValues(values: unknown) {
  return resolveRawValues(values)
    .filter((value) => value !== null && value !== undefined)
    .map((rawValue) => ({
      rawValue: toWidgetValue(rawValue),
      value: String(rawValue)
    }))
}

const modelValue = defineModel<WidgetValue>({
  default(modelProps: Record<string, unknown>) {
    try {
      const modelWidget = modelProps.widget as Props['widget'] | undefined
      const values = modelWidget?.options?.values
      const resolved = typeof values === 'function' ? values() : values
      const firstValue = Array.isArray(resolved)
        ? resolved.find((value) => value !== null && value !== undefined)
        : undefined
      return firstValue === undefined ? '' : firstValue
    } catch (error) {
      console.error('[WidgetSelectDefault] Failed to resolve options', error)
      return ''
    }
  }
})

const searchQuery = ref('')
const directory = ref<string[]>([])
const combobox = useTemplateRef('combobox')
const optionsRefreshKey = ref(0)
const isOpen = ref(false)
const searchInputContainerRef = ref<HTMLElement>()
const { handleFocusOutside, handleViewportPointerDown } =
  useRestoreFocusOnViewportPointer(focusSearchInput)

const widgetOptions = computed(
  () => widget.options as SelectWidgetOptions | undefined
)

const dynamicOptions = computed(
  () => typeof widgetOptions.value?.values === 'function'
)
const disabled = computed(() => Boolean(widgetOptions.value?.disabled))
const placeholder = computed(() => widgetOptions.value?.placeholder ?? '')
const filterPlaceholder = computed(
  () => widgetOptions.value?.filterPlaceholder ?? placeholder.value
)

function refreshOptions() {
  optionsRefreshKey.value++
}

function getOptionLabel(value: string) {
  const labeler = widgetOptions.value?.getOptionLabel
  if (!labeler) return value

  try {
    return labeler(value) || value
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to map option label', error)
    return value
  }
}

const normalizedOptions = computed<SelectOption[]>(() => {
  void optionsRefreshKey.value

  return resolveValues(widgetOptions.value?.values).map(
    ({ rawValue, value }) => ({
      kind: 'value',
      key: `value:${value}`,
      label: getOptionLabel(value),
      rawValue,
      value
    })
  )
})

const hasFolders = computed(
  () =>
    !widgetOptions.value?.getOptionLabel &&
    normalizedOptions.value.some((option) => isFilePath(option.value))
)

function isFilePath(value: string) {
  return /[/\\][^/\\]+\.[a-z][a-z0-9]{0,15}$/i.test(value)
}

const isFilterable = computed(
  () => hasFolders.value || normalizedOptions.value.length > 4
)

const filteredOptions = computed(() => {
  if (!isFilterable.value) return normalizedOptions.value

  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return normalizedOptions.value

  return normalizedOptions.value.filter(
    (option) =>
      option.value.toLocaleLowerCase().includes(query) ||
      option.label.toLocaleLowerCase().includes(query)
  )
})

const browseOptions = computed<Array<SelectOption | SelectFolder>>(() => {
  if (!hasFolders.value || searchQuery.value.trim())
    return filteredOptions.value

  const folders = new Map<string, SelectFolder>()
  const files: SelectOption[] = []
  for (const option of normalizedOptions.value) {
    const parts = isFilePath(option.value)
      ? option.value.split(/[/\\]/).filter(Boolean)
      : [option.value]
    if (!directory.value.every((part, index) => parts[index] === part)) continue
    const label = parts[directory.value.length]
    if (label === undefined) continue
    if (parts.length === directory.value.length + 1) {
      files.push({ ...option, label })
    } else if (!folders.has(label)) {
      const path = [...directory.value, label]
      folders.set(label, {
        kind: 'folder',
        key: `folder:${path.join('/')}`,
        label,
        directory: path
      })
    }
  }
  const labelCounts = countBy(files, (option) => option.label)
  return [
    ...(directory.value.length
      ? [
          {
            kind: 'back' as const,
            key: 'back',
            label: directory.value.join(' / '),
            directory: directory.value.slice(0, -1)
          }
        ]
      : []),
    ...folders.values(),
    ...files.map((option) =>
      labelCounts[option.label] > 1
        ? { ...option, label: option.value }
        : option
    )
  ]
})

const viewportStyle = computed<CSSProperties>(() => ({
  maxHeight:
    'min(30.5rem, max(2rem, calc(var(--reka-combobox-content-available-height, 100dvh) - 3rem)))',
  scrollbarGutter: 'stable'
}))

const activeDescendant = computed((): string | undefined =>
  browseOptions.value.length
    ? combobox.value?.highlightedElement?.id
    : undefined
)

const normalizedModelValue = computed(() =>
  modelValue.value == null ? undefined : String(modelValue.value)
)

const selectedOption = computed(() =>
  normalizedOptions.value.find(
    (option) => option.value === normalizedModelValue.value
  )
)

const longestLabel = computed(() =>
  normalizedOptions.value.reduce(
    (longest, { label }) => (label.length > longest.length ? label : longest),
    ''
  )
)

const isInvalid = computed(
  () =>
    widgetOptions.value?.values !== undefined &&
    modelValue.value != null &&
    modelValue.value !== '' &&
    !selectedOption.value
)

const selectedLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value.label
  if (isInvalid.value) return String(modelValue.value)
  return ''
})

const selectedSummary = computed(() =>
  filenameSummary && !widgetOptions.value?.getOptionLabel
    ? selectedLabel.value.split(/[/\\]/).at(-1)
    : selectedLabel.value
)

async function handleOptionSelect(
  event: Event,
  option: SelectOption | SelectFolder
) {
  if (option.kind === 'value') return
  event.preventDefault()
  directory.value = option.directory
  await nextTick()
  focusSearchInput()
  combobox.value?.highlightFirstItem?.()
}

function selectOption(option: SelectOption | SelectFolder | null) {
  if (!option || option.kind !== 'value') return

  modelValue.value = option.rawValue
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  searchQuery.value = ''
  isOpen.value = false
}

const { isStepDisabled, stepOption } = useComboStepping({
  options: normalizedOptions,
  selectedOption,
  disabled,
  dynamicOptions,
  refreshOptions,
  onSelect: selectOption
})

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
    const value = selectedOption.value?.value ?? ''
    directory.value =
      hasFolders.value && isFilePath(value)
        ? value.split(/[/\\]/).filter(Boolean).slice(0, -1)
        : []
  } else {
    searchQuery.value = ''
  }
}
</script>
