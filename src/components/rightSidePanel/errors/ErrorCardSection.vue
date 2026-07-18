<template>
  <section :class="cn('group flex min-w-0 flex-col py-2', className)">
    <div class="flex min-h-8 w-full items-center gap-2 px-3">
      <component
        :is="collapsible ? 'button' : 'div'"
        :type="collapsible ? 'button' : undefined"
        :class="
          cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-left',
            collapsible &&
              'focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-1'
          )
        "
        :aria-expanded="collapsible ? !collapse : undefined"
        :aria-controls="collapsible ? bodyId : undefined"
        @click="collapsible && (collapse = !collapse)"
      >
        <span
          class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive-background-hover px-1 text-2xs/none font-semibold text-white tabular-nums"
        >
          {{ count }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">
          {{ title }}
        </span>
      </component>
      <slot name="actions" />
      <button
        v-if="collapsible"
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
      <div v-if="!(collapsible && collapse)" :id="bodyId">
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

const {
  title,
  count,
  collapsible = true,
  class: className
} = defineProps<{
  title: string
  count: number
  /** When false, the section always renders expanded with no toggle UI. */
  collapsible?: boolean
  class?: string
}>()

const collapse = defineModel<boolean>('collapse', { default: false })

const bodyId = useId()
const { t } = useI18n()
</script>
