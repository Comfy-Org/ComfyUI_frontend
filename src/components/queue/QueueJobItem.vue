<template>
  <BaseJobRow
    :variant="props.state"
    :primary-text="primaryText"
    :secondary-text="rightText"
    :show-actions-on-hover="true"
    :show-clear="computedShowClear"
    :show-menu="computedShowMenu"
    :progress-total-percent="progressTotalPercent"
    :progress-current-percent="progressCurrentPercent"
    @clear="emit('clear')"
    @menu="emit('menu')"
    @view="emit('view')"
  >
    <template #icon>
      <div
        class="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[6px]"
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
      <slot name="primary">
        <template v-if="props.state === 'running'">
          <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
            <template #percent>
              <span class="font-bold">{{ formattedTotalPercent }}</span>
            </template>
          </i18n-t>
        </template>
        <template v-else>{{ primaryText }}</template>
      </slot>
    </template>
    <template #secondary>
      <slot name="secondary">
        <template
          v-if="
            props.state === 'running' &&
            props.runningNodeName &&
            props.progressCurrentPercent !== undefined
          "
        >
          <span
            class="inline-flex items-center gap-[var(--spacing-spacing-xss)]"
          >
            <span class="inline-block max-w-[10rem] truncate">{{
              props.runningNodeName
            }}</span>
            <span>{{
              t('sideToolbar.queueProgressOverlay.colonPercent', {
                percent: formattedCurrentPercent
              })
            }}</span>
          </span>
        </template>
        <template v-else>{{ rightText }}</template>
      </slot>
    </template>
  </BaseJobRow>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
    progressTotalPercent?: number
    progressCurrentPercent?: number
    runningNodeName?: string
  }>(),
  {
    rightText: '',
    iconName: undefined,
    iconImageUrl: undefined,
    showClear: undefined,
    showMenu: undefined,
    progressTotalPercent: undefined,
    progressCurrentPercent: undefined,
    runningNodeName: undefined
  }
)

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'menu'): void
  (e: 'view'): void
}>()

const { t, locale } = useI18n()

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
      return 'icon-[lucide--zap]'
    case 'completed':
      return 'icon-[lucide--check]'
    case 'failed':
      return 'icon-[lucide--alert-circle]'
    default:
      return 'icon-[lucide--circle]'
  }
})

const rightText = computed(() => props.rightText)
const runningTotalPercent = computed(() =>
  Math.max(0, Math.min(100, Math.round(props.progressTotalPercent ?? 0)))
)

const formattedTotalPercent = computed(() =>
  new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format((runningTotalPercent.value || 0) / 100)
)

const runningCurrentPercent = computed(() =>
  Math.max(0, Math.min(100, Math.round(props.progressCurrentPercent ?? 0)))
)

const formattedCurrentPercent = computed(() =>
  new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format((runningCurrentPercent.value || 0) / 100)
)

const primaryText = computed(() => {
  if (props.state === 'initialization')
    return t('queue.initializingAlmostReady')
  if (props.state === 'queued') return t('queue.inQueue')
  return props.title
})

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
