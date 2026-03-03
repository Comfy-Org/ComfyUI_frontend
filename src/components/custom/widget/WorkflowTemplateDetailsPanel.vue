<template>
  <div class="flex h-full flex-col scrollbar-custom">
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
      <WorkflowTemplateDetailsField
        v-if="description"
        :label="t('templateWorkflows.details.description')"
      >
        <p class="text-sm whitespace-pre-wrap text-muted-foreground">
          {{ description }}
        </p>
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

    <div class="mt-auto border-t border-border-default p-4 flex flex-col gap-3">
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatSize } from '@/utils/formatUtil'

import Button from '@/components/ui/button/Button.vue'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

import WorkflowTemplateDetailsField from './WorkflowTemplateDetailsField.vue'
import type { MarketplaceTemplate } from '@/platform/marketplace/types/marketplace'

const { t } = useI18n()

const { template, isInstalling = false } = defineProps<{
  template: TemplateInfo | MarketplaceTemplate
  isInstalling?: boolean
}>()

const emit = defineEmits<{
  install: [template: TemplateInfo]
}>()

const { getTemplateTitle, getTemplateDescription } = useTemplateWorkflows()

const templateInfo = computed(() => template as TemplateInfo)

const title = computed(() =>
  getTemplateTitle(
    templateInfo.value,
    templateInfo.value.sourceModule ?? 'default'
  )
)

const description = computed(() => getTemplateDescription(templateInfo.value))

const formattedVram = computed(() =>
  template.vram ? formatSize(template.vram) : null
)
</script>
