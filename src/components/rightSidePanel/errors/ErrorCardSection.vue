<template>
  <section :class="cn('group flex min-w-0 flex-col py-2', className)">
    <div class="flex min-h-8 w-full items-center gap-2 px-3">
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left ring-0 outline-0"
        :aria-expanded="!collapse"
        @click="collapse = !collapse"
      >
        <span
          class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive-background-hover px-1 text-2xs/none font-semibold text-white tabular-nums"
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
        class="flex size-8 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 ring-0 outline-0"
        :aria-expanded="!collapse"
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
      <div v-if="!collapse">
        <slot />
      </div>
    </TransitionCollapse>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'

const {
  title,
  count,
  class: className
} = defineProps<{
  title: string
  count: number
  class?: string
}>()

const collapse = defineModel<boolean>('collapse', { default: false })

const { t } = useI18n()
</script>
