<template>
  <BaseJobRow
    :variant="normalizedState"
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
      <div class="icon-box">
        <img v-if="iconImageUrl" :src="iconImageUrl" class="icon-img" />
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
  | 'loading'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

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

const normalizedState = computed(() =>
  props.state === 'cancelled' ? 'failed' : props.state
)

const iconClass = computed(() => {
  if (props.iconName) return props.iconName
  switch (props.state) {
    case 'added':
      return 'icon-[lucide--plus]'
    case 'queued':
      return 'icon-[lucide--clock]'
    case 'loading':
      return 'icon-[lucide--loader-circle] animate-spin'
    case 'running':
      return 'icon-[lucide--play]'
    case 'completed':
      return 'icon-[lucide--check]'
    case 'failed':
    case 'cancelled':
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
    case 'loading':
    case 'running':
    case 'cancelled':
      return false
  }
  return false
})

const computedShowMenu = computed(() => {
  if (props.showMenu !== undefined) return props.showMenu
  return true
})
</script>

<style scoped>
.icon-box {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--color-charcoal-500);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
