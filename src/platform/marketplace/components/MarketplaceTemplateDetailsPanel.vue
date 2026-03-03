<template>
  <div class="flex h-full flex-col scrollbar-custom">
    <PropertiesAccordionItem
      class="border-t border-border-default bg-transparent"
    >
      <template #label>
        <span class="text-xs font-inter uppercase select-none">
          {{ t('templateWorkflows.details.overview') }}
        </span>
      </template>
      <DetailsField
        :label="t('templateWorkflows.details.name')"
        :value="submission.template.title ?? submission.template.name"
      />
      <DetailsField
        v-if="submission.shortDescription"
        :label="t('templateWorkflows.publish.shortDescription')"
      >
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {{ submission.shortDescription }}
        </p>
      </DetailsField>
      <DetailsField
        :label="t('templateWorkflows.publish.difficulty')"
        :value="submission.difficulty"
      />
      <DetailsField
        :label="t('templateWorkflows.publish.version')"
        :value="submission.version"
      />
    </PropertiesAccordionItem>

    <PropertiesAccordionItem
      class="border-t border-border-default bg-transparent"
    >
      <template #label>
        <span class="text-xs font-inter uppercase select-none">
          {{ t('templateWorkflows.details.publishing') }}
        </span>
      </template>
      <DetailsField :label="t('templateWorkflows.myTemplates.statusLabel')">
        <StatusBadge
          class="self-start"
          :label="
            t(`templateWorkflows.myTemplates.status.${submission.status}`)
          "
          :severity="STATUS_SEVERITY[submission.status]"
        />
      </DetailsField>
      <DetailsField
        v-if="submission.reviewFeedback"
        :label="t('templateWorkflows.myTemplates.reviewFeedback')"
      >
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {{ submission.reviewFeedback }}
        </p>
      </DetailsField>
      <DetailsField
        v-if="submission.createdAt"
        :label="t('templateWorkflows.myTemplates.createdAt')"
        :value="formatDate(submission.createdAt)"
      />
      <DetailsField
        v-if="submission.updatedAt"
        :label="t('templateWorkflows.myTemplates.updatedAt')"
        :value="formatDate(submission.updatedAt)"
      />
    </PropertiesAccordionItem>

    <PropertiesAccordionItem
      v-if="
        submission.template.models?.length ||
        submission.template.requiresCustomNodes?.length
      "
      class="border-t border-border-default bg-transparent"
    >
      <template #label>
        <span class="text-xs font-inter uppercase select-none">
          {{ t('templateWorkflows.details.requirements') }}
        </span>
      </template>
      <DetailsField
        v-if="submission.template.models?.length"
        :label="t('templateWorkflows.details.models')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="model in submission.template.models"
            :key="model"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ model }}
          </span>
        </div>
      </DetailsField>
      <DetailsField
        v-if="submission.template.requiresCustomNodes?.length"
        :label="t('templateWorkflows.details.customNodes')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="node in submission.template.requiresCustomNodes"
            :key="node"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ node }}
          </span>
        </div>
      </DetailsField>
      <DetailsField
        v-if="submission.template.vram"
        :label="t('templateWorkflows.details.vram')"
        :value="formatSize(submission.template.vram)"
      />
    </PropertiesAccordionItem>

    <PropertiesAccordionItem
      v-if="hasStats"
      class="border-t border-border-default bg-transparent"
    >
      <template #label>
        <span class="text-xs font-inter uppercase select-none">
          {{ t('templateWorkflows.myTemplates.stats') }}
        </span>
      </template>
      <DetailsField
        :label="t('templateWorkflows.myTemplates.downloads')"
        :value="String(submission.stats.downloads)"
      />
      <DetailsField
        :label="t('templateWorkflows.myTemplates.favorites')"
        :value="String(submission.stats.favorites)"
      />
      <DetailsField
        :label="t('templateWorkflows.myTemplates.rating')"
        :value="String(submission.stats.rating)"
      />
    </PropertiesAccordionItem>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import StatusBadge from '@/components/common/StatusBadge.vue'
import type { StatusBadgeVariants } from '@/components/common/statusBadge.variants'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import WorkflowTemplateDetailsField from '@/components/custom/widget/WorkflowTemplateDetailsField.vue'
import { formatSize } from '@/utils/formatUtil'

import type { MarketplaceTemplate, TemplateStatus } from '../types/marketplace'

const DetailsField = WorkflowTemplateDetailsField

const { t } = useI18n()

const { submission } = defineProps<{
  submission: MarketplaceTemplate
}>()

const STATUS_SEVERITY: Record<TemplateStatus, StatusBadgeVariants['severity']> =
  {
    draft: 'secondary',
    pending_review: 'warn',
    approved: 'default',
    rejected: 'danger',
    unpublished: 'secondary'
  }

const hasStats = computed(
  () =>
    submission.stats.downloads > 0 ||
    submission.stats.favorites > 0 ||
    submission.stats.rating > 0
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}
</script>
