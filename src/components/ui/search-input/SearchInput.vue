<template>
  <ComboboxRoot :open="false" ignore-filter :disabled :class="className">
    <ComboboxAnchor
      :class="
        cn(
          searchInputVariants({ size }),
          disabled && 'pointer-events-none opacity-50'
        )
      "
      @click="focus"
    >
      <Button
        v-if="modelValue"
        :class="cn('absolute', sizeConfig.clearPos)"
        variant="textonly"
        size="icon-sm"
        :aria-label="$t('g.clear')"
        @click.stop="clearSearch"
      >
        <i :class="cn('icon-[lucide--x]', sizeConfig.icon)" />
      </Button>
      <i
        v-else-if="loading"
        :class="
          cn(
            'pointer-events-none absolute icon-[lucide--loader-circle] animate-spin',
            sizeConfig.iconPos,
            sizeConfig.icon
          )
        "
      />
      <i
        v-else
        :class="
          cn(
            'pointer-events-none absolute',
            sizeConfig.iconPos,
            sizeConfig.icon,
            icon
          )
        "
      />

      <ComboboxInput
        ref="inputRef"
        v-model="modelValue"
        :class="
          cn(
            'size-full border-none bg-transparent outline-none',
            sizeConfig.inputPl,
            sizeConfig.inputText
          )
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
import {
  searchInputSizeConfig,
  searchInputVariants
} from './searchInput.variants'

const { t } = useI18n()

const {
  placeholder,
  icon = 'icon-[lucide--search]',
  debounceTime = 300,
  autofocus = false,
  loading = false,
  disabled = false,
  size = 'md',
  class: className
} = defineProps<{
  placeholder?: string
  icon?: string
  debounceTime?: number
  autofocus?: boolean
  loading?: boolean
  disabled?: boolean
  size?: SearchInputVariants['size']
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  search: [value: string]
}>()

const sizeConfig = computed(() => searchInputSizeConfig[size])

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
