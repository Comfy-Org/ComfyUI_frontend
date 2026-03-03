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
        :value="submission.title ?? submission.name"
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
      v-if="submission.models?.length || submission.requiresCustomNodes?.length"
      class="border-t border-border-default bg-transparent"
    >
      <template #label>
        <span class="text-xs font-inter uppercase select-none">
          {{ t('templateWorkflows.details.requirements') }}
        </span>
      </template>
      <DetailsField
        v-if="submission.models?.length"
        :label="t('templateWorkflows.details.models')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="model in submission.models"
            :key="model"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ model }}
          </span>
        </div>
      </DetailsField>
      <DetailsField
        v-if="submission.requiresCustomNodes?.length"
        :label="t('templateWorkflows.details.customNodes')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="node in submission.requiresCustomNodes"
            :key="node"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ node }}
          </span>
        </div>
      </DetailsField>
      <DetailsField
        v-if="submission.vram"
        :label="t('templateWorkflows.details.vram')"
        :value="formatSize(submission.vram)"
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

    <div class="mt-auto border-t border-border-default p-4 flex flex-col gap-2">
      <template v-if="confirmingRemove">
        <p class="m-0 text-sm text-muted">
          {{ t('templateWorkflows.myTemplates.confirmRemove') }}
        </p>
        <div class="flex gap-2">
          <Button
            variant="destructive"
            size="lg"
            class="flex-1"
            @click="emit('remove', submission.id)"
          >
            {{ t('templateWorkflows.myTemplates.removeConfirm') }}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            class="flex-1"
            @click="confirmingRemove = false"
          >
            {{ t('templateWorkflows.publish.cancel') }}
          </Button>
        </div>
      </template>
      <template v-else>
        <Button
          variant="primary"
          size="lg"
          class="w-full"
          @click="emit('edit', submission.id)"
        >
          <i class="icon-[lucide--pencil] size-4" />
          {{ t('templateWorkflows.myTemplates.edit') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          class="w-full"
          @click="confirmingRemove = true"
        >
          <i class="icon-[lucide--trash-2] size-4" />
          {{ t('templateWorkflows.myTemplates.remove') }}
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
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

const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
}>()

const confirmingRemove = ref(false)

const STATUS_SEVERITY: Record<TemplateStatus, StatusBadgeVariants['severity']> =
  {
    draft: 'muted',
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
