<template>
  <Teleport to="body">
    <FocusScope as-child trapped loop>
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="t('gettingStarted.title')"
        tabindex="-1"
        class="fixed inset-0 z-2000 flex overflow-y-auto bg-base-background focus:outline-none"
        @keydown.escape.capture.prevent="dismissGettingStarted()"
      >
        <div
          class="m-auto flex w-full max-w-5xl flex-col items-center gap-8 px-8 py-16"
        >
          <div class="flex flex-col items-center gap-3">
            <h1
              class="m-0 text-center text-4xl font-medium text-base-foreground"
            >
              {{ t('gettingStarted.title') }}
            </h1>
            <p class="m-0 text-center text-base text-muted-foreground">
              {{ t('gettingStarted.subtitle') }}
            </p>
          </div>
          <div class="grid w-full grid-cols-2 gap-5 lg:grid-cols-4">
            <div
              v-for="template in templates"
              :key="template.name"
              role="button"
              tabindex="0"
              :data-testid="`getting-started-card-${template.name}`"
              class="group/card focus-visible:ring-ring relative min-w-0 cursor-pointer overflow-hidden rounded-2xl **:cursor-pointer focus-visible:ring-1 focus-visible:outline-none"
              @click="pick(template.name)"
              @keydown.enter.prevent="pick(template.name)"
              @keydown.space.prevent="pick(template.name)"
              @mouseenter="hoveredId = template.name"
              @mouseleave="hoveredId = null"
            >
              <DefaultThumbnail
                :src="getTemplateThumbnailUrl(template, 'default')"
                :alt="getTemplateTitle(template, 'default')"
                :hover-zoom="5"
                :is-hovered="hoveredId === template.name"
                :is-video="template.mediaType === 'video'"
              />
              <h3
                class="absolute inset-x-0 bottom-0 m-0 truncate bg-linear-to-t from-black/60 to-transparent p-4 text-sm font-semibold text-white"
              >
                {{ getTemplateTitle(template, 'default') }}
              </h3>
              <div
                v-if="loadingTemplateId === template.name"
                class="absolute inset-0 flex items-center justify-center bg-base-background/70"
              >
                <Loader size="md" />
              </div>
            </div>
          </div>
          <Button
            variant="muted-textonly"
            data-testid="getting-started-blank"
            @click="dismissGettingStarted()"
          >
            {{ t('gettingStarted.startBlank') }}
          </Button>
        </div>
      </div>
    </FocusScope>
  </Teleport>
</template>

<script setup lang="ts">
import { FocusScope } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import Button from '@/components/ui/button/Button.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

import { CURATED_TEMPLATE_IDS } from './curatedTemplates'
import { useFirstRunEntry } from './firstRunEntry'

const { t } = useI18n()
const { dismissGettingStarted, hideGettingStarted } = useFirstRunEntry()
const templatesStore = useWorkflowTemplatesStore()
const {
  loadWorkflowTemplate,
  loadingTemplateId,
  getTemplateThumbnailUrl,
  getTemplateTitle
} = useTemplateWorkflows()

const hoveredId = ref<string | null>(null)

const templates = computed(() =>
  CURATED_TEMPLATE_IDS.map((id) => templatesStore.getTemplateByName(id)).filter(
    (template) => template !== undefined
  )
)

onMounted(async () => {
  if (import.meta.env.DEV)
    console.warn(
      '[first-run] screen mounted, catalog:',
      templatesStore.isLoaded
    )
  if (!templatesStore.isLoaded) await templatesStore.loadWorkflowTemplates()
  if (import.meta.env.DEV)
    console.warn('[first-run] curated resolved:', templates.value.length)
  if (!templates.value.length) hideGettingStarted()
})

async function pick(id: string) {
  if (loadingTemplateId.value) return
  if (await loadWorkflowTemplate(id, 'default')) {
    await dismissGettingStarted()
    return
  }
  useToastStore().add({
    severity: 'error',
    summary: t('g.error'),
    detail: t('gettingStarted.templateFailed')
  })
}
</script>
