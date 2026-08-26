<template>
  <section :class="cn('group flex min-w-0 flex-col py-2', className)">
    <div class="flex min-h-8 w-full items-center gap-2 px-3">
      <button
        type="button"
        class="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-1"
        :aria-expanded="!collapse"
        :aria-controls="bodyId"
        @click="collapse = !collapse"
      >
        <span
          data-testid="error-section-count-badge"
          :data-severity="severity"
          :class="
            cn(
              'flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-2xs/none font-semibold tabular-nums',
              severity === 'error'
                ? 'bg-destructive-background-hover text-white'
                : 'bg-warning-background text-warning-on-background'
            )
          "
        >
          {{ count }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">
          {{ title }}
        </span>
      </button>
      <slot name="actions" />
      <button
        type="button"
        class="focus-visible:ring-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:ring-1"
        :aria-expanded="!collapse"
        :aria-controls="bodyId"
        :aria-label="
          collapse ? t('rightSidePanel.expand') : t('rightSidePanel.collapse')
        "
        @click="collapse = !collapse"
      >
        <i
          aria-hidden="true"
          :class="
            cn(
              'icon-[lucide--chevron-up] size-4 text-muted-foreground transition-transform group-hover:text-base-foreground',
              collapse && '-rotate-180'
            )
          "
        />
      </button>
    </div>
    <TransitionCollapse>
      <div v-if="!collapse" :id="bodyId">
        <slot />
      </div>
    </TransitionCollapse>
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import type { ErrorGroupSeverity } from '@/components/rightSidePanel/errors/types'

const {
  title,
  count,
  severity,
  class: className
} = defineProps<{
  title: string
  count: number
  severity: ErrorGroupSeverity
  class?: string
}>()

const collapse = defineModel<boolean>('collapse', { default: false })

const bodyId = useId()
const { t } = useI18n()
</script>
