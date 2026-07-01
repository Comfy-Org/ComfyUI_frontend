<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import LazyImage from '@/components/common/LazyImage.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { app } from '@/scripts/app'

const FEATURED_COUNT = 4

const { t } = useI18n()
const templatesStore = useWorkflowTemplatesStore()
const {
  isTemplatesLoaded,
  loadingTemplateId,
  loadTemplates,
  getTemplateTitle,
  getEffectiveSourceModule,
  isAppTemplate,
  getBaseThumbnailSrc,
  loadWorkflowTemplate
} = useTemplateWorkflows()
const templateSelectorDialog = useWorkflowTemplateSelectorDialog()

onMounted(() => void loadTemplates())

const featuredTemplates = computed(() => {
  const all = templatesStore.enhancedTemplates
  const apps = all.filter(isAppTemplate)
  return (apps.length ? apps : all).slice(0, FEATURED_COUNT)
})

function titleOf(template: TemplateInfo) {
  return getTemplateTitle(template, getEffectiveSourceModule(template))
}

async function selectTemplate(template: TemplateInfo) {
  await loadWorkflowTemplate(template.name, getEffectiveSourceModule(template))
}

function importWorkflow() {
  app.ui.loadFile()
}

function discoverAll() {
  templateSelectorDialog.show('appbuilder')
}
</script>

<template>
  <div
    data-testid="linear-get-started"
    class="flex size-full min-h-0 flex-col items-center overflow-y-auto bg-base-background px-8 pt-[clamp(96px,18vh,200px)] pb-16"
  >
    <div class="flex w-full max-w-[860px] flex-col items-center gap-8">
      <div class="flex flex-col items-center gap-1 text-center">
        <h1 class="text-[44px] leading-none font-medium text-base-foreground">
          {{ t('linearMode.getStarted.title') }}
        </h1>
        <p class="max-w-[520px] text-sm/relaxed text-muted-foreground">
          {{ t('linearMode.getStarted.subtitle') }}
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          variant="textonly"
          size="md"
          class="rounded-full bg-interface-menu-component-surface-selected px-3 hover:bg-interface-menu-component-surface-selected"
        >
          <i class="icon-[lucide--layout-template] size-3.5" />
          {{ t('linearMode.getStarted.templates') }}
        </Button>
        <Button
          type="button"
          variant="textonly"
          size="md"
          class="rounded-full bg-interface-menu-component-surface-hovered px-3 opacity-70 hover:bg-interface-menu-component-surface-selected hover:opacity-100"
          data-testid="linear-get-started-import"
          @click="importWorkflow"
        >
          <i class="icon-[lucide--upload] size-3.5" />
          {{ t('linearMode.getStarted.importWorkflow') }}
        </Button>
      </div>

      <div class="flex flex-col items-center gap-8">
        <div class="flex flex-wrap items-center justify-center gap-5">
          <template v-if="isTemplatesLoaded">
            <button
              v-for="template in featuredTemplates"
              :key="template.name"
              type="button"
              data-testid="linear-get-started-template"
              class="group relative flex size-50 cursor-pointer appearance-none flex-col overflow-hidden rounded-2xl border-none bg-base-background p-0 text-left"
              @click="selectTemplate(template)"
            >
              <div
                class="absolute inset-0 overflow-hidden rounded-2xl bg-dialog-surface"
              >
                <LazyImage
                  :src="getBaseThumbnailSrc(template)"
                  alt=""
                  image-class="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />
              </div>
              <div
                class="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-black/40 via-transparent to-black/50"
              />
              <i
                v-if="loadingTemplateId === template.name"
                class="absolute inset-0 z-20 m-auto icon-[lucide--loader-2] size-8 animate-spin text-white"
              />
              <span
                class="relative z-10 mt-auto w-full truncate p-3 text-sm font-semibold text-white"
              >
                {{ titleOf(template) }}
              </span>
            </button>
          </template>
          <template v-else>
            <div
              v-for="n in FEATURED_COUNT"
              :key="n"
              class="size-50 animate-pulse rounded-2xl bg-dialog-surface"
            />
          </template>
        </div>

        <Button
          variant="textonly"
          size="lg"
          data-testid="linear-get-started-discover"
          @click="discoverAll"
        >
          {{ t('linearMode.getStarted.discoverAll') }}
          <i class="icon-[lucide--arrow-right] size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
