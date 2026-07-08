<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'

import LazyImage from '@/components/common/LazyImage.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { resolvePrioritizedIds } from '@/platform/remoteUserData/resolvePrioritizedIds'
import { useRemoteUserData } from '@/platform/remoteUserData/useRemoteUserData'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import {
  getBaseThumbnailSrc,
  getEffectiveSourceModule,
  getTemplateTitle,
  isAppTemplate
} from '@/platform/workflow/templates/utils/templateUtil'
import { useCommandStore } from '@/stores/commandStore'

const FEATURED_COUNT = 4

const { t } = useI18n()
const templatesStore = useWorkflowTemplatesStore()
const toastStore = useToastStore()
const commandStore = useCommandStore()
const {
  isTemplatesLoaded,
  loadingTemplateId,
  loadTemplates,
  loadWorkflowTemplate
} = useTemplateWorkflows()
const templateSelectorDialog = useWorkflowTemplateSelectorDialog()

const { data: templateOrder, isLoaded: isOrderLoaded } = useRemoteUserData({
  key: 'app-mode-template-order',
  schema: z.object({ templateIds: z.array(z.string()) }),
  defaultValue: { templateIds: [] }
})

onMounted(() => void loadTemplates())

const featuredTemplates = computed(() => {
  const all = templatesStore.enhancedTemplates
  const apps = all.filter(isAppTemplate)
  const candidates = apps.length ? apps : all
  const byName = new Map(
    candidates.map((template) => [template.name, template])
  )
  const orderedNames = resolvePrioritizedIds(
    templateOrder.value.templateIds,
    candidates.map((template) => template.name),
    new Set(byName.keys()),
    FEATURED_COUNT
  )
  return orderedNames.map((name) => byName.get(name)!)
})

const isFeaturedReady = computed(
  () => isTemplatesLoaded.value && isOrderLoaded.value
)

const isLoadingTemplate = computed(() => loadingTemplateId.value !== null)

function titleOf(template: TemplateInfo) {
  return getTemplateTitle(template, getEffectiveSourceModule(template))
}

async function selectTemplate(template: TemplateInfo) {
  const loaded = await loadWorkflowTemplate(
    template.name,
    getEffectiveSourceModule(template)
  )
  if (!loaded) {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('linearMode.getStarted.loadFailed')
    })
  }
}
</script>

<template>
  <div
    data-testid="linear-get-started"
    class="flex size-full min-h-0 flex-col items-center overflow-y-auto px-8 pt-[clamp(96px,18vh,200px)] pb-16"
  >
    <div class="flex w-full max-w-4xl flex-col items-center gap-8">
      <div class="flex flex-col items-center gap-1 text-center">
        <h1 class="text-5xl leading-none font-medium text-base-foreground">
          {{ t('linearMode.getStarted.title') }}
        </h1>
        <p class="max-w-lg text-sm/relaxed text-muted-foreground">
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
          :disabled="isLoadingTemplate"
          @click="commandStore.execute('Comfy.OpenWorkflow')"
        >
          <i class="icon-[lucide--upload] size-3.5" />
          {{ t('linearMode.getStarted.importWorkflow') }}
        </Button>
      </div>

      <div class="flex flex-col items-center gap-8">
        <div class="flex flex-wrap items-center justify-center gap-5">
          <template v-if="isFeaturedReady">
            <button
              v-for="template in featuredTemplates"
              :key="template.name"
              type="button"
              data-testid="linear-get-started-template"
              :data-template-name="template.name"
              class="group relative flex size-50 cursor-pointer appearance-none flex-col overflow-hidden rounded-2xl border-none bg-base-background p-0 text-left disabled:cursor-default"
              :disabled="isLoadingTemplate"
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
          :disabled="isLoadingTemplate"
          @click="templateSelectorDialog.show('appbuilder')"
        >
          {{ t('linearMode.getStarted.discoverAll') }}
          <i class="icon-[lucide--arrow-right] size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
