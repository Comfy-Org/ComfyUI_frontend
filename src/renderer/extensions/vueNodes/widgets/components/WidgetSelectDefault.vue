<template>
  <WidgetLayoutField :widget>
    <ComboboxRoot
      v-model:open="isOpen"
      :model-value="comboboxValue"
      :by="isSelectedOption"
      :disabled
      ignore-filter
      selection-behavior="replace"
      :reset-search-term-on-select="false"
      @update:model-value="selectOption"
      @update:open="handleOpenChange"
    >
      <ComboboxAnchor as-child>
        <ComboboxTrigger as-child>
          <button
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            :aria-label="widget.label || widget.name"
            :aria-invalid="isInvalid || undefined"
            :aria-expanded="isOpen"
            :disabled
            tabindex="0"
            data-capture-wheel="true"
            data-testid="widget-select-default-trigger"
            :class="
              cn(
                WidgetInputBaseClass,
                'flex h-7 w-full min-w-0 cursor-pointer items-center overflow-hidden outline-none hover:bg-component-node-widget-background-hovered disabled:cursor-default disabled:opacity-50 disabled:hover:bg-component-node-widget-background',
                isInvalid && 'ring-1 ring-destructive-background'
              )
            "
          >
            <span
              :class="
                cn(
                  'min-w-[4ch] flex-1 truncate pr-3 pl-1 text-left',
                  $slots.default && 'mr-5'
                )
              "
            >
              {{ selectedLabel || placeholder || '\u00a0' }}
            </span>
            <span
              class="flex h-full w-8 shrink-0 items-center justify-center rounded-r-lg"
            >
              <i
                :class="
                  cn(
                    isResolving
                      ? 'icon-[lucide--loader-circle] animate-spin'
                      : 'icon-[lucide--chevron-down]',
                    'size-4 translate-x-1.5',
                    disabled
                      ? 'bg-component-node-foreground-secondary'
                      : 'bg-muted-foreground'
                  )
                "
                data-testid="widget-select-trigger-icon"
                aria-hidden="true"
              />
            </span>
          </button>
        </ComboboxTrigger>
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          data-capture-wheel="true"
          data-testid="widget-select-default-overlay"
          position="popper"
          :side-offset="1"
          align="start"
          :class="
            cn(
              'z-3000 overflow-hidden rounded-lg border border-solid border-border-default bg-base-background p-0 text-base-foreground shadow-md',
              'max-w-[min(90vw,48rem)] min-w-(--reka-combobox-trigger-width)'
            )
          "
          @keydown.escape.stop="handleOpenChange(false)"
          @focus-outside="handleFocusOutside"
        >
          <div
            v-if="isFilterable"
            ref="searchInputContainerRef"
            class="m-1 flex items-center gap-2 rounded-md border border-solid border-border-default px-2 py-1.5 transition-colors focus-within:border-primary-background"
          >
            <i
              class="icon-[lucide--search] shrink-0 text-sm text-muted-foreground"
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
            class="max-h-56 min-w-full scrollbar-thin scrollbar-thumb-alpha-smoke-500-50 scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto p-1 text-xs"
            :style="viewportStyle"
            @pointerdown.capture.self="handleViewportPointerDown"
          >
            <template v-if="isResolving">
              <div
                class="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground"
                data-testid="widget-select-default-loading"
              >
                <i
                  class="icon-[lucide--loader-circle] size-4 animate-spin"
                  aria-hidden="true"
                />
                <span>{{ $t('g.loading') }}</span>
              </div>
            </template>
            <template v-else-if="filteredOptions.length > 0">
              <div aria-hidden="true" class="invisible h-0 overflow-hidden">
                <div class="flex items-center gap-3 p-2">
                  <span class="whitespace-nowrap">{{ longestLabel }}</span>
                  <span class="size-3.5 shrink-0" />
                </div>
              </div>

              <ComboboxVirtualizer
                v-slot="{ option }"
                :options="filteredOptions"
                :estimate-size="32"
                :overscan="20"
                :text-content="getVirtualizerTextContent"
              >
                <ComboboxItem
                  :key="option.key"
                  :value="option.comboboxValue"
                  :text-value="option.label"
                  :title="option.label"
                  :class="
                    cn(
                      'flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-sm p-2 outline-none select-none',
                      'hover:bg-secondary-background data-highlighted:bg-secondary-background',
                      'data-[state=checked]:bg-primary-background/20 data-[state=checked]:hover:bg-primary-background/20 data-[state=checked]:data-highlighted:bg-primary-background/30'
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
                      class="icon-[lucide--check] size-3.5 text-base-foreground"
                      aria-hidden="true"
                    />
                  </ComboboxItemIndicator>
                </ComboboxItem>
              </ComboboxVirtualizer>
            </template>

            <div
              v-else
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

    <div class="absolute top-5 right-8 flex h-4 w-7 -translate-y-4/5">
      <slot />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxVirtualizer
} from 'reka-ui'
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'

import { useRestoreFocusOnViewportPointer } from '@/renderer/extensions/vueNodes/widgets/composables/useRestoreFocusOnViewportPointer'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

interface Props {
  widget: SimplifiedWidget<string | undefined>
}

interface SelectOption {
  comboboxValue: string
  key: string
  label: string
  value: string
}

type SelectWidgetOptions = NonNullable<Props['widget']['options']> & {
  filterPlaceholder?: string
}

const { widget } = defineProps<Props>()

// Reka reserves an empty string value for clearing the combobox. Encode values
// internally so custom-node combo options can still use '' like PrimeVue/legacy.
const COMBOBOX_VALUE_PREFIX = 'widget-select-value:'
const MAX_VISIBLE_OPTIONS = 7

function toComboboxValue(value: string) {
  return `${COMBOBOX_VALUE_PREFIX}${value}`
}

function fromComboboxValue(value: string | undefined) {
  if (value === undefined || !value.startsWith(COMBOBOX_VALUE_PREFIX)) {
    return undefined
  }

  return value.slice(COMBOBOX_VALUE_PREFIX.length)
}

// So reka scrolls to the selected option on open instead of the top.
function isSelectedOption(
  option: SelectOption | string,
  value: string
): boolean {
  const optionValue = typeof option === 'string' ? option : option.comboboxValue
  return optionValue === value
}

function resolveRawValues(values: unknown): unknown[] {
  try {
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved) ? resolved : []
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to resolve options', error)
    return []
  }
}

function resolveValues(values: unknown): string[] {
  return resolveRawValues(values)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
}

const modelValue = defineModel<string | undefined>({
  default(modelProps: Props) {
    try {
      const values = modelProps.widget.options?.values
      const resolved = typeof values === 'function' ? values() : values
      const firstValue = Array.isArray(resolved)
        ? resolved.find((value) => value !== null && value !== undefined)
        : undefined
      return firstValue === undefined ? '' : String(firstValue)
    } catch (error) {
      console.error('[WidgetSelectDefault] Failed to resolve options', error)
      return ''
    }
  }
})

const searchQuery = ref('')
const optionsRefreshKey = ref(0)
const isOpen = ref(false)
const isResolving = ref(false)
const searchInputContainerRef = ref<HTMLElement>()

const { start: startResolveTimer, stop: stopResolveTimer } = useTimeoutFn(
  () => {
    isResolving.value = false
    refreshOptions()
  },
  0,
  { immediate: false }
)
const { handleFocusOutside, handleViewportPointerDown } =
  useRestoreFocusOnViewportPointer(focusSearchInput)

const widgetOptions = computed(
  () => widget.options as SelectWidgetOptions | undefined
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

function getVirtualizerTextContent(option: SelectOption): string {
  return option.label
}

const resolvedValues = computed(() => {
  void optionsRefreshKey.value
  return resolveValues(widgetOptions.value?.values)
})

const knownOptionValues = computed(() => new Set(resolvedValues.value))

const isFilterable = computed(() => resolvedValues.value.length > 4)

const normalizedOptions = computed<SelectOption[]>(() => {
  return resolvedValues.value.map((value, index) => ({
    comboboxValue: toComboboxValue(value),
    key: `${value}-${index}`,
    label: getOptionLabel(value),
    value
  }))
})

const filteredOptions = computed(() => {
  if (isResolving.value) return []

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

const longestLabel = computed(() =>
  normalizedOptions.value.reduce(
    (longest, opt) => (opt.label.length > longest.length ? opt.label : longest),
    ''
  )
)

const comboboxValue = computed(() => {
  const value = modelValue.value
  if (value === undefined || !knownOptionValues.value.has(value)) return ''

  return toComboboxValue(value)
})

const isInvalid = computed(
  () =>
    modelValue.value !== undefined &&
    modelValue.value !== '' &&
    !knownOptionValues.value.has(modelValue.value)
)

const selectedLabel = computed(() => {
  const value = modelValue.value
  if (value === undefined) return ''
  if (!knownOptionValues.value.has(value)) return String(value)
  return getOptionLabel(value)
})

function selectOption(rekaValue: string | undefined) {
  const value = fromComboboxValue(rekaValue)
  if (value === undefined || !knownOptionValues.value.has(value)) return

  modelValue.value = value
  searchQuery.value = ''
  isOpen.value = false
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
    const values = widgetOptions.value?.values
    if (!values || (Array.isArray(values) && values.length <= 100)) {
      isResolving.value = false
      refreshOptions()
    } else {
      isResolving.value = true
      startResolveTimer()
    }
  } else {
    searchQuery.value = ''
    isResolving.value = false
    stopResolveTimer()
  }
}
</script>
