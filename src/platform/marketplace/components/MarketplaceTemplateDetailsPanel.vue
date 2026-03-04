<template>
  <div class="flex flex-grow flex-col">
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
      <DetailsField :label="t('g.author')">
        <span class="flex items-center gap-1 text-sm text-muted-foreground">
          {{ submission.author.name }}
          <i
            v-if="submission.author.isVerified"
            class="icon-[lucide--badge-check] size-4 text-blue-500"
          />
        </span>
      </DetailsField>
      <DetailsField
        v-if="submission.shortDescription"
        :label="t('templateWorkflows.publish.shortDescription')"
      >
        <div
          class="comfy-markdown-content text-sm text-muted-foreground"
          v-html="renderedShortDescription"
        />
      </DetailsField>
      <DetailsField
        v-if="submission.difficulty"
        :label="t('templateWorkflows.publish.difficulty')"
      >
        <span class="flex items-center gap-2 text-sm text-muted-foreground">
          <img
            :src="DIFFICULTY_SPRITES[submission.difficulty]"
            :alt="submission.difficulty"
            class="size-6 rounded-sm object-cover"
          />
          {{ t(`templateWorkflows.publish.${submission.difficulty}`) }}
        </span>
      </DetailsField>
      <DetailsField
        :label="t('templateWorkflows.publish.version')"
        :value="submission.version"
      />
      <DetailsField
        v-if="submission.categories?.length"
        :label="t('templateWorkflows.publish.categories')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="category in submission.categories"
            :key="category"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ category }}
          </span>
        </div>
      </DetailsField>
      <DetailsField
        v-if="submission.tags?.length"
        :label="t('templateWorkflows.publish.tags')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="tag in submission.tags"
            :key="tag"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ tag }}
          </span>
        </div>
      </DetailsField>
      <DetailsField
        v-if="submission.license"
        :label="t('templateWorkflows.publish.license')"
        :value="
          t(
            `templateWorkflows.publish.licenses.${submission.license}`,
            submission.license
          )
        "
      />
      <DetailsField
        v-if="submission.tutorialUrl"
        :label="t('templateWorkflows.publish.tutorialUrl')"
      >
        <a
          :href="submission.tutorialUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-blue-500 break-all hover:underline"
        >
          {{ submission.tutorialUrl }}
        </a>
      </DetailsField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem
      :collapse="true"
      class="border-t border-border-default bg-transparent"
    >
      <template #label>
        <span class="text-xs font-inter uppercase select-none">
          {{ t('templateWorkflows.details.publishing') }}
        </span>
      </template>
      <div class="flex items-center justify-between px-4 py-2">
        <span class="text-sm select-none">
          {{ t('templateWorkflows.myTemplates.statusLabel') }}
        </span>
        <StatusBadge
          :label="
            t(`templateWorkflows.myTemplates.status.${submission.status}`)
          "
          :severity="STATUS_SEVERITY[submission.status]"
        />
      </div>
      <DetailsField
        v-if="submission.reviewFeedback"
        :label="t('templateWorkflows.myTemplates.reviewFeedback')"
      >
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {{ submission.reviewFeedback }}
        </p>
      </DetailsField>
      <div class="flex flex-col gap-3 px-4 py-2">
        <div
          v-if="submission.createdAt"
          class="flex items-center justify-between"
        >
          <span class="text-sm select-none">
            {{ t('templateWorkflows.myTemplates.createdAt') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ formatDate(submission.createdAt) }}
          </span>
        </div>
        <div
          v-if="submission.updatedAt"
          class="flex items-center justify-between"
        >
          <span class="text-sm select-none">
            {{ t('templateWorkflows.myTemplates.updatedAt') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ formatDate(submission.updatedAt) }}
          </span>
        </div>
        <div
          v-if="submission.publishedAt"
          class="flex items-center justify-between"
        >
          <span class="text-sm select-none">
            {{ t('templateWorkflows.myTemplates.publishedAt') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ formatDate(submission.publishedAt) }}
          </span>
        </div>
      </div>
      <DetailsField
        v-if="submission.changelog"
        :label="t('templateWorkflows.publish.changelog')"
      >
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {{ submission.changelog }}
        </p>
      </DetailsField>
      <TemplateStatsDisplay :stats="submission.stats" />
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

    <div class="mt-auto border-t border-border-default p-4 flex flex-col gap-2">
      <WorkflowPreview
        :workflow-json="graphPreviewJson"
        :loading="graphPreviewLoading"
      />
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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import WorkflowPreview from '@/components/templates/WorkflowPreview.vue'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import WorkflowTemplateDetailsField from '@/components/custom/widget/WorkflowTemplateDetailsField.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { WorkflowJsonInput } from '@/renderer/extensions/minimap/data/WorkflowJsonDataSource'
import { formatSize } from '@/utils/formatUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import { DIFFICULTY_SPRITES, STATUS_SEVERITY } from '../types/marketplace'
import type { MarketplaceTemplate } from '../types/marketplace'
import TemplateStatsDisplay from './TemplateStatsDisplay.vue'

const DetailsField = WorkflowTemplateDetailsField

const { t } = useI18n()
const { fetchTemplateJson } = useTemplateWorkflows()

const { submission } = defineProps<{
  submission: MarketplaceTemplate
}>()

const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
}>()

const confirmingRemove = ref(false)

const renderedShortDescription = computed(() =>
  renderMarkdownToHtml(submission.shortDescription ?? '')
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

const graphPreviewLoading = ref(false)
const graphPreviewJson = ref<WorkflowJsonInput | null>(null)

onMounted(async () => {
  const name = submission.name
  if (!name) return
  graphPreviewLoading.value = true
  try {
    const sourceModule = submission.sourceModule ?? 'default'
    const json = await fetchTemplateJson(name, sourceModule)
    graphPreviewJson.value = json as WorkflowJsonInput
  } catch (e) {
    console.error('Failed to load workflow preview:', e)
  } finally {
    graphPreviewLoading.value = false
  }
})
</script>
