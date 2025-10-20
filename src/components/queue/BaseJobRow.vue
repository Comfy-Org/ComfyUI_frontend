<template>
  <div
    class="relative flex items-center justify-between gap-[var(--spacing-spacing-xs)] overflow-hidden rounded-[var(--corner-radius-corner-radius-md)] border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-600)] p-[var(--spacing-spacing-xxs)] text-[12px] text-white transition-colors duration-150 ease-in-out hover:border-[var(--color-charcoal-300)] hover:bg-[var(--color-charcoal-500)]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div
      v-if="
        variant === 'running' &&
        (progressTotalPercent !== undefined ||
          progressCurrentPercent !== undefined)
      "
      class="absolute inset-0"
    >
      <div
        v-if="progressTotalPercent !== undefined"
        class="pointer-events-none absolute inset-y-0 left-0 h-full bg-[var(--color-interface-panel-job-progress-primary)] transition-[width]"
        :style="{ width: `${progressTotalPercent}%` }"
      />
      <div
        v-if="progressCurrentPercent !== undefined"
        class="pointer-events-none absolute inset-y-0 left-0 h-full bg-[var(--color-interface-panel-job-progress-secondary)] transition-[width]"
        :style="{ width: `${progressCurrentPercent}%` }"
      />
    </div>
    <div
      class="relative z-[1] flex items-center gap-[var(--spacing-spacing-xxs)]"
    >
      <div
        class="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px]"
      >
        <slot name="icon">
          <i v-if="iconName" :class="[iconName, 'size-4']" />
          <div v-else class="h-full w-full" />
        </slot>
      </div>
    </div>

    <div class="relative z-[1] min-w-0 flex-1">
      <div class="truncate opacity-90" :title="primaryText">
        <slot name="primary">{{ primaryText }}</slot>
      </div>
    </div>

    <div
      class="relative z-[1] flex items-center gap-[var(--spacing-spacing-xs)] text-[var(--color-slate-100)]"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition-opacity transition-transform duration-150 ease-out"
        leave-active-class="transition-opacity transition-transform duration-150 ease-in"
        enter-from-class="opacity-0 translate-y-0.5"
        enter-to-class="opacity-100 translate-y-0"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-0.5"
      >
        <div
          v-if="isHovered && showActionsOnHover"
          key="actions"
          class="inline-flex items-center gap-[var(--spacing-spacing-xs)] pr-[calc(var(--spacing-spacing-xs)-var(--spacing-spacing-xxs))]"
        >
          <button
            v-if="variant !== 'completed' && showClear"
            type="button"
            class="inline-flex h-6 transform items-center gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-sm,4px)] border-0 bg-[var(--color-charcoal-300)] px-[var(--spacing-spacing-xxs)] py-0 text-white transition duration-150 ease-in-out hover:-translate-y-px hover:opacity-95"
            :aria-label="t('g.clear')"
            @click.stop="emit('clear')"
          >
            <i class="icon-[lucide--x] size-4" />
          </button>
          <button
            v-else-if="variant === 'completed'"
            type="button"
            class="inline-flex h-6 transform items-center gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-sm,4px)] border-0 bg-[var(--color-charcoal-300)] px-[var(--spacing-spacing-xs)] py-0 text-white transition duration-150 ease-in-out hover:-translate-y-px hover:opacity-95"
            :aria-label="t('menuLabels.View')"
            @click.stop="emit('view')"
          >
            <span>{{ t('menuLabels.View') }}</span>
          </button>
          <button
            v-if="showMenu"
            type="button"
            class="inline-flex h-6 transform items-center gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-sm,4px)] border-0 bg-[var(--color-charcoal-300)] px-[var(--spacing-spacing-xxs)] py-0 text-white transition duration-150 ease-in-out hover:-translate-y-px hover:opacity-95"
            :aria-label="t('g.moreOptions')"
            @click.stop="emit('menu')"
          >
            <i class="icon-[lucide--more-horizontal] size-4" />
          </button>
        </div>
        <div v-else key="secondary" class="pr-[var(--spacing-spacing-xs)]">
          <slot name="secondary">{{ secondaryText }}</slot>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { JobState } from '@/types/queue'

withDefaults(
  defineProps<{
    primaryText?: string
    secondaryText?: string
    iconName?: string
    variant?: JobState
    showActionsOnHover?: boolean
    showClear?: boolean
    showMenu?: boolean
    progressTotalPercent?: number
    progressCurrentPercent?: number
  }>(),
  {
    primaryText: '',
    secondaryText: '',
    iconName: undefined,
    variant: 'queued',
    showActionsOnHover: true,
    showClear: true,
    showMenu: true,
    progressTotalPercent: undefined,
    progressCurrentPercent: undefined
  }
)

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'menu'): void
  (e: 'view'): void
}>()

const isHovered = ref(false)

const { t } = useI18n()
</script>
