<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Tag from '@/components/chip/Tag.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

const { t } = useI18n()

const tooltipCopy = computed(() => {
  const title = t('templateWorkflows.paidTemplate.title')
  const credits = t('templateWorkflows.paidTemplate.credits')

  return {
    title,
    credits,
    label: [title, credits].join(' ')
  }
})
</script>

<template>
  <Tooltip
    :config="tooltipCopy.label"
    side="bottom"
    open-on-click
    suppress-description
  >
    <button
      type="button"
      :aria-label="tooltipCopy.label"
      data-testid="paid-template-badge"
      class="cursor-pointer rounded-lg border-none bg-transparent p-0 focus-visible:ring-1 focus-visible:ring-base-foreground focus-visible:outline-none"
    >
      <Tag
        :label="$t('templateWorkflows.paidTemplate.badgeLabel')"
        shape="overlay"
        class="h-7 rounded-lg bg-black/30 px-2 backdrop-blur-[20px] [&>span]:sr-only"
      >
        <template #icon>
          <i
            class="icon-[tabler--crown-filled] size-4 text-brand-yellow"
            aria-hidden="true"
          />
        </template>
      </Tag>
    </button>

    <template #content>
      <div class="text-left leading-normal">
        <p class="m-0 font-semibold">{{ tooltipCopy.title }}</p>
        <p class="m-0">{{ tooltipCopy.credits }}</p>
      </div>
    </template>
  </Tooltip>
</template>
