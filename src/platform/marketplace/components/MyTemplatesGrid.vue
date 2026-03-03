<template>
  <!-- Empty State -->
  <div
    v-if="templates.length === 0 && !loading"
    class="flex h-64 flex-col items-center justify-center"
  >
    <i class="mb-4 icon-[lucide--package-open] size-12 text-muted opacity-50" />
    <p class="mb-2 text-lg text-muted">
      {{ t('templateWorkflows.myTemplates.empty') }}
    </p>
    <Button variant="primary" size="lg" @click="emit('create')">
      <i class="icon-[lucide--plus] size-4" />
      {{ t('templateWorkflows.myTemplates.createFirst') }}
    </Button>
  </div>

  <div v-else class="flex flex-col gap-4">
    <div class="flex justify-end">
      <Button variant="primary" size="lg" @click="emit('create')">
        <i class="icon-[lucide--plus] size-4" />
        {{ t('templateWorkflows.publish.newTemplate') }}
      </Button>
    </div>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
      <CardContainer
        v-for="submission in templates"
        :key="submission.id"
        size="compact"
        variant="ghost"
        rounded="lg"
        class="hover:bg-base-background"
        @click="emit('select', submission)"
      >
        <template #top>
          <CardTop ratio="square">
            <div
              class="flex h-full w-full items-center justify-center bg-dialog-surface"
            >
              <i class="icon-[lucide--image] size-8 text-muted opacity-30" />
            </div>
            <template #bottom-right>
              <StatusBadge
                :label="statusLabel(submission.status)"
                :severity="statusSeverity(submission.status)"
              />
            </template>
          </CardTop>
        </template>
        <template #bottom>
          <CardBottom>
            <div class="flex flex-col gap-1 pt-3">
              <h3 class="m-0 line-clamp-1 text-sm">
                {{ submission.template.title ?? submission.template.name }}
              </h3>
              <p class="m-0 line-clamp-2 text-sm text-muted">
                {{ submission.shortDescription }}
              </p>
            </div>
          </CardBottom>
        </template>
      </CardContainer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import type { StatusBadgeVariants } from '@/components/common/statusBadge.variants'
import type { MarketplaceTemplate, TemplateStatus } from '../types/marketplace'

const { t } = useI18n()

defineProps<{
  templates: MarketplaceTemplate[]
  loading?: boolean
}>()

const emit = defineEmits<{
  create: []
  select: [template: MarketplaceTemplate]
}>()

const STATUS_SEVERITY: Record<TemplateStatus, StatusBadgeVariants['severity']> =
  {
    draft: 'secondary',
    pending_review: 'warn',
    approved: 'default',
    rejected: 'danger',
    unpublished: 'secondary'
  }

function statusSeverity(
  status: TemplateStatus
): StatusBadgeVariants['severity'] {
  return STATUS_SEVERITY[status]
}

function statusLabel(status: TemplateStatus): string {
  const key = `templateWorkflows.myTemplates.status.${status}` as const
  return t(key)
}
</script>
