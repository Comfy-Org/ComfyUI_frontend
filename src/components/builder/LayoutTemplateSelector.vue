<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { LayoutTemplateId } from '@/components/builder/layoutTemplates'
import { LAYOUT_TEMPLATES } from '@/components/builder/layoutTemplates'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const selected = defineModel<LayoutTemplateId>({ required: true })
</script>

<template>
  <div
    class="fixed top-1/2 left-4 z-1000 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border-default bg-base-background p-1.5 shadow-interface"
  >
    <button
      v-for="template in LAYOUT_TEMPLATES"
      :key="template.id"
      v-tooltip.right="t(template.description)"
      :class="
        cn(
          'flex cursor-pointer items-center justify-center rounded-lg border-2 p-2 transition-colors',
          selected === template.id
            ? 'border-primary-background bg-primary-background/10'
            : 'border-transparent bg-transparent hover:bg-secondary-background'
        )
      "
      :aria-label="t(template.label)"
      :aria-pressed="selected === template.id"
      @click="selected = template.id"
    >
      <i :class="cn(template.icon, 'size-5')" />
    </button>
  </div>
</template>
