<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import TagRemoveButton from './TagRemoveButton.vue'
import { tagVariants } from './tag.variants'
import type { TagVariants } from './tag.variants'

const {
  label,
  shape = 'square',
  state = 'default',
  removable = false,
  removeLabel,
  removeTooltip,
  as = 'span',
  interactive = false,
  class: className
} = defineProps<{
  label: string
  shape?: TagVariants['shape']
  state?: TagVariants['state']
  removable?: boolean
  removeLabel?: string
  removeTooltip?: string
  as?: PrimitiveProps['as']
  interactive?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  remove: [event: Event]
}>()

const tagClass = computed(() =>
  cn(tagVariants({ shape, state, removable, interactive }), className)
)

function handleKeydown(event: KeyboardEvent): void {
  if (!interactive || as === 'button') return
  if (event.key === 'Enter' || event.key === ' ') event.preventDefault()
  if (event.key === 'Enter' && event.currentTarget instanceof HTMLElement)
    event.currentTarget.click()
}

function handleKeyup(event: KeyboardEvent): void {
  if (!interactive || as === 'button' || event.key !== ' ') return
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.click()
}
</script>

<template>
  <Primitive
    :as
    :class="tagClass"
    @keydown="handleKeydown"
    @keyup="handleKeyup"
  >
    <slot name="icon" />
    <span class="min-w-0 truncate">{{ label }}</span>
    <slot />
    <TagRemoveButton
      v-if="removable"
      :label="removeLabel ?? $t('g.remove')"
      :tooltip="removeTooltip"
      @click.stop="emit('remove', $event)"
    />
  </Primitive>
</template>
