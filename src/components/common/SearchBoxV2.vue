<template>
  <div class="flex flex-col gap-2">
    <ComboboxRoot
      v-model:search-term="searchTerm"
      :ignore-filter="true"
      :open="false"
    >
      <ComboboxAnchor
        :class="
          cn(
            'relative flex w-full cursor-text items-center',
            'rounded-lg bg-comfy-input text-comfy-input-foreground',
            showBorder &&
              'border border-solid border-border-default box-border',
            sizeClasses,
            className
          )
        "
      >
        <i
          v-if="!searchTerm"
          :class="
            cn('absolute pointer-events-none', icon, iconClass, iconPosition)
          "
        />
        <Button
          v-else
          :class="cn('absolute', clearButtonPosition)"
          variant="textonly"
          size="icon"
          :aria-label="$t('g.clear')"
          @click="clearSearch"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>

        <ComboboxInput
          ref="inputRef"
          v-model="searchTerm"
          :class="
            cn(
              'size-full border-none bg-transparent text-sm outline-none',
              inputPadding
            )
          "
          :placeholder
          :auto-focus="autofocus"
        />
      </ComboboxAnchor>
    </ComboboxRoot>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { watchDebounced } from '@vueuse/core'
import { ComboboxAnchor, ComboboxInput, ComboboxRoot } from 'reka-ui'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  placeholder = 'Search...',
  icon = 'pi pi-search',
  debounceTime = 300,
  autofocus = false,
  showBorder = false,
  size = 'md',
  class: className
} = defineProps<{
  placeholder?: string
  icon?: string
  debounceTime?: number
  autofocus?: boolean
  showBorder?: boolean
  size?: 'md' | 'lg'
  class?: string
}>()

const emit = defineEmits<{
  search: [value: string]
}>()

const searchTerm = defineModel<string>({ required: true })

const inputRef = ref<InstanceType<typeof ComboboxInput> | null>(null)

defineExpose({
  focus: () => {
    inputRef.value?.$el?.focus()
  }
})

const isLarge = computed(() => size === 'lg')

const sizeClasses = computed(() =>
  showBorder
    ? isLarge.value
      ? 'h-10 p-2'
      : 'h-8 p-2'
    : isLarge.value
      ? 'h-12 px-4 py-2'
      : 'h-10 px-4 py-2'
)

const iconClass = computed(() => (isLarge.value ? 'size-5' : 'size-4'))
const iconPosition = computed(() => (isLarge.value ? 'left-4' : 'left-4'))
const clearButtonPosition = computed(() =>
  isLarge.value ? 'left-2' : 'left-2'
)
const inputPadding = computed(() => (isLarge.value ? 'pl-8' : 'pl-6'))

function clearSearch() {
  searchTerm.value = ''
}

watchDebounced(
  searchTerm,
  (value: string) => {
    emit('search', value)
  },
  { debounce: debounceTime }
)
</script>
