<script setup lang="ts" generic="T extends string">
import { Check, ChevronDown } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'

import { fieldClass } from '@/components/cms/ui/field'

/** A single-choice dropdown in the admin's field style. */
const {
  options,
  name,
  label,
  placeholder,
  disabled = false
} = defineProps<{
  options: { value: T; label: string }[]
  /** Submits the choice with a surrounding form. */
  name?: string
  label?: string
  placeholder?: string
  disabled?: boolean
}>()
const model = defineModel<T>()
</script>

<template>
  <SelectRoot v-model="model" :name :disabled>
    <SelectTrigger
      :aria-label="label"
      :class="
        cn(fieldClass, 'flex cursor-pointer items-center gap-2 text-left')
      "
    >
      <SelectValue
        :placeholder
        class="flex-1 truncate data-placeholder:text-admin-subtle"
      />
      <ChevronDown class="size-4 shrink-0 text-admin-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 min-w-(--reka-select-trigger-width) overflow-hidden rounded-lg border border-admin-line bg-admin-card p-1 font-admin text-sm text-admin-fg shadow-admin-popover"
      >
        <SelectViewport>
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            class="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none data-highlighted:bg-admin-hover"
          >
            <SelectItemText class="flex-1">{{ option.label }}</SelectItemText>
            <SelectItemIndicator>
              <Check class="size-3.5" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
