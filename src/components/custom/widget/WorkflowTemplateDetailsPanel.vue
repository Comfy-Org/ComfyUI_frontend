<template>
  <div class="flex flex-col flex-grow">
    <div class="flex flex-col flex-grow">
      <PropertiesAccordionItem
        class="bg-transparent border-t border-border-default"
      >
        <template #label>
          <span class="text-xs uppercase font-inter select-none">
            {{ t('templateWorkflows.details.overview') }}
          </span>
        </template>
        <WorkflowTemplateDetailsField
          :label="t('templateWorkflows.details.name')"
          :value="title"
        />
        <WorkflowTemplateDetailsField :label="t('g.author')">
          <span class="flex items-center gap-1 text-sm text-muted-foreground">
            {{ authorName }}
            <i
              v-if="isAuthorVerified"
              class="icon-[lucide--badge-check] size-4 text-blue-500"
            />
          </span>
        </WorkflowTemplateDetailsField>
        <WorkflowTemplateDetailsField
          v-if="isMarketplaceTemplate(template) && template.difficulty"
          :label="t('templateWorkflows.publish.difficulty')"
        >
          <span class="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              :src="DIFFICULTY_SPRITES[template.difficulty]"
              :alt="template.difficulty"
              class="size-5 rounded-sm object-cover"
            />
            {{ t(`templateWorkflows.publish.${template.difficulty}`) }}
          </span>
        </WorkflowTemplateDetailsField>
        <WorkflowTemplateDetailsField
          v-if="description"
          :label="t('templateWorkflows.details.description')"
        >
          <div
            class="comfy-markdown-content text-sm text-muted-foreground"
            v-html="renderedDescription"
          />
        </WorkflowTemplateDetailsField>
        <WorkflowTemplateDetailsField
          v-if="template.useCase"
          :label="t('templateWorkflows.details.useCase')"
          :value="template.useCase"
        />
        <WorkflowTemplateDetailsField
          v-if="template.license"
          :label="t('templateWorkflows.details.license')"
          :value="template.license"
        />
        <TemplateStatsDisplay
          v-if="isMarketplaceTemplate(template)"
          :stats="template.stats"
        />
      </PropertiesAccordionItem>

      <PropertiesAccordionItem
        v-if="template.models?.length || template.requiresCustomNodes?.length"
        class="bg-transparent border-t border-border-default"
      >
        <template #label>
          <span class="text-xs uppercase font-inter select-none">
            {{ t('templateWorkflows.details.requirements') }}
          </span>
        </template>
        <WorkflowTemplateDetailsField
          v-if="template.models?.length"
          :label="t('templateWorkflows.details.models')"
        >
          <div class="flex flex-wrap gap-1">
            <span
              v-for="model in template.models"
              :key="model"
              class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
            >
              {{ model }}
            </span>
          </div>
        </WorkflowTemplateDetailsField>
        <WorkflowTemplateDetailsField
          v-if="template.requiresCustomNodes?.length"
          :label="t('templateWorkflows.details.customNodes')"
        >
          <div class="flex flex-wrap gap-1">
            <span
              v-for="node in template.requiresCustomNodes"
              :key="node"
              class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
            >
              {{ node }}
            </span>
          </div>
        </WorkflowTemplateDetailsField>
        <WorkflowTemplateDetailsField
          v-if="formattedVram"
          :label="t('templateWorkflows.details.vram')"
          :value="formattedVram"
        />
      </PropertiesAccordionItem>

      <PropertiesAccordionItem
        v-if="template.tags?.length"
        class="bg-transparent border-t border-border-default"
      >
        <template #label>
          <span class="text-xs uppercase font-inter select-none">
            {{ t('templateWorkflows.details.tags') }}
          </span>
        </template>
        <div class="flex flex-wrap gap-1 px-4 py-2">
          <span
            v-for="tag in template.tags"
            :key="tag"
            class="rounded-md bg-dialog-surface px-2 py-0.5 text-xs text-muted-foreground"
          >
            {{ tag }}
          </span>
        </div>
      </PropertiesAccordionItem>
    </div>

    <div class="mt-auto border-t border-border-default p-4 flex flex-col gap-3">
      <WorkflowPreview
        :workflow-json="graphPreviewJson"
        :loading="graphPreviewLoading"
      />
      <Button
        variant="primary"
        size="lg"
        class="w-full"
        :loading="isInstalling"
        @click="emit('install', templateInfo)"
      >
        <i class="icon-[lucide--download] size-4" />
        {{ t('templateWorkflows.details.install') }}
      </Button>
      <a
        v-if="template.tutorialUrl"
        :href="template.tutorialUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
      >
        {{ t('templateWorkflows.details.viewTutorial') }}
        <i class="icon-[lucide--external-link] size-4" />
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatSize } from '@/utils/formatUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import Button from '@/components/ui/button/Button.vue'
import WorkflowPreview from '@/components/templates/WorkflowPreview.vue'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import type { WorkflowJsonInput } from '@/renderer/extensions/minimap/data/WorkflowJsonDataSource'

import WorkflowTemplateDetailsField from './WorkflowTemplateDetailsField.vue'
import type { MarketplaceTemplate } from '@/platform/marketplace/types/marketplace'
import {
  DIFFICULTY_SPRITES,
  isMarketplaceTemplate
} from '@/platform/marketplace/types/marketplace'
import TemplateStatsDisplay from '@/platform/marketplace/components/TemplateStatsDisplay.vue'

const { t } = useI18n()

const { template, isInstalling = false } = defineProps<{
  template: TemplateInfo | MarketplaceTemplate
  isInstalling?: boolean
}>()

const emit = defineEmits<{
  install: [template: TemplateInfo]
}>()

const { getTemplateTitle, getTemplateDescription, fetchTemplateJson } =
  useTemplateWorkflows()

const templateInfo = computed(() => template as TemplateInfo)

const title = computed(() =>
  getTemplateTitle(
    templateInfo.value,
    templateInfo.value.sourceModule ?? 'default'
  )
)

const description = computed(() => getTemplateDescription(templateInfo.value))
const renderedDescription = computed(() =>
  renderMarkdownToHtml(description.value)
)

const authorName = computed(() =>
  isMarketplaceTemplate(template) ? template.author.name : 'Comfy Team'
)

const isAuthorVerified = computed(() =>
  isMarketplaceTemplate(template) ? template.author.isVerified : true
)

const formattedVram = computed(() =>
  template.vram ? formatSize(template.vram) : null
)

const graphPreviewLoading = ref(false)
const graphPreviewJson = ref<WorkflowJsonInput | null>(null)

onMounted(async () => {
  graphPreviewLoading.value = true
  try {
    const sourceModule = templateInfo.value.sourceModule ?? 'default'
    const json = await fetchTemplateJson(templateInfo.value.name, sourceModule)
    graphPreviewJson.value = json as WorkflowJsonInput
  } catch (e) {
    console.error('Failed to load workflow preview:', e)
  } finally {
    graphPreviewLoading.value = false
  }
})
</script>
