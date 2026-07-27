<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Tag from '@/components/chip/Tag.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'

const { openSource } = defineProps<{
  openSource?: boolean
}>()

const { t } = useI18n()

const tooltipCopy = computed(() => {
  const title = t('templateWorkflows.paidTemplate.title')
  const partnerNodes = t('templateWorkflows.paidTemplate.partnerNodes')
  const paidPlan = t('templateWorkflows.paidTemplate.paidPlan')

  return {
    title,
    partnerNodes,
    paidPlan,
    label: [title, partnerNodes, paidPlan].join(' ')
  }
})
</script>

<template>
  <AccessibleTooltip
    v-if="openSource === false"
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
        <p class="m-0">
          {{ tooltipCopy.partnerNodes }}<br />
          {{ tooltipCopy.paidPlan }}
        </p>
      </div>
    </template>
  </AccessibleTooltip>
</template>
