<template>
  <SelectRoot v-model="selected" v-model:open="isOpen">
    <SelectTrigger
      :aria-label="label"
      :class="selectTriggerVariants({ size: 'lg', border: 'none' })"
    >
      <div
        class="flex flex-1 items-center gap-2 overflow-hidden py-2 pl-2 text-sm"
      >
        <SelectValue class="truncate" />
      </div>
      <div :class="selectDropdownClass">
        <i class="icon-[lucide--chevron-down] text-muted-foreground" />
      </div>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="8"
        align="start"
        :class="cn(selectContentClass, 'min-w-(--reka-select-trigger-width)')"
        @keydown="onContentKeydown"
      >
        <SelectViewport
          :style="{ maxHeight: 'min(28rem, 50vh)' }"
          class="scrollbar-custom w-full"
        >
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :class="selectItemVariants({ layout: 'single' })"
          >
            <SelectItemText class="truncate">
              {{ option.name }}
            </SelectItemText>
            <SelectItemIndicator
              class="flex shrink-0 items-center justify-center"
            >
              <i
                class="icon-[lucide--check] text-base-foreground"
                aria-hidden="true"
              />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
/**
 * The cloud app's single select, reduced to what the saved-method picker
 * uses: the large trigger and a flat option list.
 */
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
import { ref } from 'vue'

import {
  selectContentClass,
  selectDropdownClass,
  selectItemVariants,
  selectTriggerVariants,
  stopEscapeToDocument
} from '@comfyorg/design-system/select.variants'
import { cn } from '@comfyorg/tailwind-utils'

const { label, options } = defineProps<{
  label: string
  options: readonly { name: string; value: string }[]
}>()

const selected = defineModel<string>({ required: true })

const isOpen = ref(false)

function onContentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopEscapeToDocument(event)
    isOpen.value = false
  }
}
</script>
