<template>
  <BaseJobRow
    :variant="props.state"
    :primary-text="title"
    :secondary-text="rightText"
    :show-actions-on-hover="true"
    :show-clear="computedShowClear"
    :show-menu="computedShowMenu"
    @clear="emit('clear')"
    @menu="emit('menu')"
    @view="emit('view')"
  >
    <template #icon>
      <div
        class="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--color-charcoal-500)]"
      >
        <img
          v-if="iconImageUrl"
          :src="iconImageUrl"
          class="h-full w-full object-cover"
        />
        <i v-else :class="[iconClass, 'size-4']" />
      </div>
    </template>
    <template #primary>
      <slot name="primary">{{ title }}</slot>
    </template>
    <template #secondary>
      <slot name="secondary">{{ rightText }}</slot>
    </template>
  </BaseJobRow>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import BaseJobRow from './BaseJobRow.vue'

type JobState =
  | 'added'
  | 'queued'
  | 'initialization'
  | 'running'
  | 'completed'
  | 'failed'

const props = withDefaults(
  defineProps<{
    state: JobState
    title: string
    rightText?: string
    iconName?: string
    iconImageUrl?: string
    showClear?: boolean
    showMenu?: boolean
  }>(),
  {
    rightText: '',
    iconName: undefined,
    iconImageUrl: undefined,
    showClear: undefined,
    showMenu: undefined
  }
)

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'menu'): void
  (e: 'view'): void
}>()

const iconClass = computed(() => {
  if (props.iconName) return props.iconName
  switch (props.state) {
    case 'added':
      return 'icon-[lucide--plus]'
    case 'queued':
      return 'icon-[lucide--clock]'
    case 'initialization':
      return 'icon-[lucide--server-crash]'
    case 'running':
      return 'icon-[lucide--play]'
    case 'completed':
      return 'icon-[lucide--check]'
    case 'failed':
      return 'icon-[lucide--alert-circle]'
  }
  return 'icon-[lucide--circle]'
})

const rightText = computed(() => props.rightText)

const computedShowClear = computed(() => {
  if (props.showClear !== undefined) return props.showClear
  switch (props.state) {
    case 'queued':
    case 'failed':
    case 'added':
      return true
    case 'initialization':
    case 'running':
      return false
  }
  return false
})

const computedShowMenu = computed(() => {
  if (props.showMenu !== undefined) return props.showMenu
  return true
})
</script>
