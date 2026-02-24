<template>
  <ComboboxRoot :ignore-filter="true" :open="false">
    <ComboboxAnchor
      :class="cn(searchInputVariants({ size }), className)"
      @click="focus"
    >
      <Button
        v-if="modelValue"
        class="absolute left-3.5"
        variant="textonly"
        size="icon-sm"
        :aria-label="$t('g.clear')"
        @click.stop="clearSearch"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
      <i
        v-else-if="loading"
        class="icon-[lucide--loader-circle] absolute left-4 size-4 animate-spin pointer-events-none"
      />
      <i
        v-else
        :class="cn('absolute left-4 size-4 pointer-events-none', icon)"
      />

      <ComboboxInput
        ref="inputRef"
        v-model="modelValue"
        :class="
          cn('size-full border-none bg-transparent text-sm outline-none pl-8')
        "
        :placeholder="placeholderText"
        :auto-focus="autofocus"
      />
    </ComboboxAnchor>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'
import { watchDebounced } from '@vueuse/core'
import { ComboboxAnchor, ComboboxInput, ComboboxRoot } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { SearchInputVariants } from './searchInput.variants'
import { searchInputVariants } from './searchInput.variants'

const { t } = useI18n()

const {
  placeholder,
  icon = 'icon-[lucide--search]',
  debounceTime = 300,
  autofocus = false,
  loading = false,
  size = 'md',
  class: className
} = defineProps<{
  placeholder?: string
  icon?: string
  debounceTime?: number
  autofocus?: boolean
  loading?: boolean
  size?: SearchInputVariants['size']
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  search: [value: string]
}>()

const modelValue = defineModel<string>({ required: true })

const inputRef = ref<InstanceType<typeof ComboboxInput> | null>(null)

function focus() {
  inputRef.value?.$el?.focus()
}

defineExpose({ focus })

const placeholderText = computed(
  () => placeholder ?? t('g.searchPlaceholder', { subject: '' })
)

function clearSearch() {
  modelValue.value = ''
  focus()
}

watchDebounced(
  modelValue,
  (value: string) => {
    emit('search', value)
  },
  { debounce: debounceTime }
)
</script>
