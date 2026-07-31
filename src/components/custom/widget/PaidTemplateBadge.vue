<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Tag from '@/components/chip/Tag.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'

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
  <AccessibleTooltip
    :label="tooltipCopy.label"
    test-id="paid-template-badge"
    side="bottom"
    trigger-class="rounded-lg"
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

    <template #content>
      <div class="text-left leading-normal">
        <p class="m-0 font-semibold">{{ tooltipCopy.title }}</p>
        <p class="m-0">{{ tooltipCopy.credits }}</p>
      </div>
    </template>
  </AccessibleTooltip>
</template>
