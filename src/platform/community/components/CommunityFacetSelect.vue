<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  FocusScope
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  selectContentClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@/components/ui/select/select.variants'
import type { SelectOption } from '@/components/ui/select/types'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

const {
  label,
  options = [],
  disabled = false,
  icon,
  defaultValue
} = defineProps<{
  label: string
  options?: SelectOption[]
  disabled?: boolean
  icon?: string
  defaultValue?: string
}>()
const selected = defineModel<string | undefined>({ required: true })
const isOpen = ref(false)
const query = ref('')
const liftedContentStyle = useModalLiftedZIndex(isOpen)
const selectedName = computed(
  () => options.find((option) => option.value === selected.value)?.name
)
const matches = computed(() => {
  const terms = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  return options.filter((option) =>
    terms.every((term) => option.name.toLowerCase().includes(term))
  )
})
const visible = computed(() => matches.value.slice(0, 50))
watch(isOpen, (open) => {
  if (open) query.value = ''
})
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopEscapeToDocument(event)
    isOpen.value = false
  }
}
</script>

<template>
  <ComboboxRoot
    v-model="selected"
    v-model:open="isOpen"
    :disabled
    ignore-filter
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger
        role="combobox"
        :aria-label="label"
        :title="icon ? `${label}: ${selectedName || label}` : undefined"
        :class="
          cn(
            selectTriggerVariants({
              size: icon ? 'md' : 'lg',
              border:
                icon && selected && selected !== defaultValue
                  ? 'active'
                  : 'none'
            }),
            icon && 'w-11 justify-center gap-1'
          )
        "
      >
        <i
          v-if="icon"
          :class="cn(icon, 'size-4 shrink-0')"
          aria-hidden="true"
        />
        <span
          :class="
            cn(
              'min-w-0 flex-1 truncate px-2 text-left text-sm',
              icon && 'sr-only'
            )
          "
          >{{ selectedName || label }}</span
        >
        <i
          :class="
            cn(
              'icon-[lucide--chevron-down] shrink-0',
              icon ? 'size-3' : 'size-4'
            )
          "
          aria-hidden="true"
        />
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="8"
        align="start"
        :class="cn(selectContentClass, icon && 'p-1')"
        :style="liftedContentStyle"
        @keydown="onKeydown"
        @focus-outside.prevent
      >
        <FocusScope class="contents" @mount-auto-focus.prevent>
          <ComboboxInput
            v-model="query"
            :aria-label="$t('community.searchFacet', { label })"
            :placeholder="$t('community.searchFacet', { label })"
            :class="
              cn(
                'm-2 w-64 rounded-md border border-border-default bg-secondary-background px-3 py-2 text-sm outline-none focus-visible:ring-1',
                icon && 'm-1 w-56 px-2 py-1.5'
              )
            "
          />
          <ComboboxViewport
            :class="cn('max-h-80 min-w-72 overflow-y-auto', icon && 'min-w-60')"
          >
            <ComboboxItem
              v-for="option in visible"
              :key="option.value"
              :value="option.value"
              :class="
                cn(
                  selectItemVariants({ layout: 'single' }),
                  icon && 'gap-2 py-1.5'
                )
              "
            >
              <span class="truncate">{{ option.name }}</span>
            </ComboboxItem>
          </ComboboxViewport>
          <p v-if="!matches.length" role="status" class="m-0 p-3 text-sm">
            {{ $t('g.noResultsFound') }}
          </p>
          <p
            v-else-if="matches.length > visible.length"
            role="status"
            class="m-0 max-w-72 p-3 text-xs text-muted-foreground"
          >
            {{ $t('community.refineFacet', { count: visible.length }) }}
          </p>
        </FocusScope>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
