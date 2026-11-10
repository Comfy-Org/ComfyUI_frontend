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
      :open="isOpen"
      :model-value="selectedOption ?? null"
      by="value"
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
          position="popper"
          :side-offset="1"
          align="end"
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
              data-testid="widget-select-default-search-input"
              class="w-full border-none bg-transparent text-xs outline-none"
            />
          </div>

          <div
            data-testid="widget-select-default-viewport"
            role="presentation"
            class="max-h-56 min-w-full scrollbar-thin scrollbar-thumb-smoke-500/50 scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto p-1 text-xs"
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
              v-slot="{ option }"
              :options="filteredOptions"
              :estimate-size="32"
              :text-content="(option) => option.label"
            >
              <ComboboxItem
                :value="option"
                :text-value="option.label"
                :class="
                  cn(
                    'flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-sm p-2 outline-none select-none',
                    'hover:bg-secondary data-highlighted:bg-secondary',
                    'data-[state=checked]:bg-primary/20 data-[state=checked]:hover:bg-primary/20 data-[state=checked]:data-highlighted:bg-primary/30'
                  )
                "
              >
                <span class="truncate">
                  {{ option.label }}
                </span>
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

            <div
              v-if="filteredOptions.length === 0"
              role="status"
              aria-live="polite"
              class="p-2 text-xs text-muted-foreground"
            >
              {{ $t('g.noResultsFound') }}
            </div>
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
import { computed, ref, useId } from 'vue'
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

interface Props {
  widget: SimplifiedWidget<string | undefined>
  filenameSummary?: boolean
}

interface SelectOption {
  label: string
  rawValue: NonNullable<WidgetValue>
  value: string
}

type SelectWidgetOptions = NonNullable<Props['widget']['options']> & {
  filterPlaceholder?: string
}

const { widget, filenameSummary = false } = defineProps<Props>()
const inputId = useId()
const widgetLabel = computed(() => widget.label || widget.name)

const MAX_VISIBLE_OPTIONS = 7

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
      label: getOptionLabel(value),
      rawValue,
      value
    })
  )
})

const isFilterable = computed(() => normalizedOptions.value.length > 4)

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

const viewportStyle = computed<CSSProperties>(() => ({
  overflowY:
    filteredOptions.value.length > MAX_VISIBLE_OPTIONS ? 'scroll' : 'auto',
  scrollbarGutter: 'stable'
}))

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

function selectOption(option: SelectOption | null) {
  if (!option) return

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
  } else {
    searchQuery.value = ''
  }
}
</script>
