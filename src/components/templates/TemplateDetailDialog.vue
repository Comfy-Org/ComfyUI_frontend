<template>
  <div
    class="flex max-h-[85vh] flex-col overflow-hidden md:min-h-[560px] md:flex-row"
  >
    <!-- Media -->
    <div
      class="template-detail-media relative aspect-square w-full shrink-0 overflow-hidden bg-black/30 md:w-[45%]"
    >
      <template v-if="template.mediaType === 'audio'">
        <AudioThumbnail :src="baseThumbnailSrc" />
      </template>
      <template v-else-if="template.thumbnailVariant === 'compareSlider'">
        <CompareSliderThumbnail
          :base-image-src="baseThumbnailSrc"
          :overlay-image-src="overlayThumbnailSrc"
          :alt="title"
          :is-hovered="true"
          :is-video="isVideoMedia"
        />
      </template>
      <template v-else-if="template.thumbnailVariant === 'hoverDissolve'">
        <HoverDissolveThumbnail
          :base-image-src="baseThumbnailSrc"
          :overlay-image-src="overlayThumbnailSrc"
          :alt="title"
          :is-hovered="true"
          :is-video="isVideoMedia"
        />
      </template>
      <template v-else>
        <DefaultThumbnail
          :src="baseThumbnailSrc"
          :alt="title"
          :is-hovered="false"
          :is-video="isVideoMedia"
          :hover-zoom="0"
        />
      </template>
      <LogoOverlay
        v-if="template.logos?.length"
        :logos="template.logos"
        :get-logo-url="workflowTemplatesStore.getLogoUrl"
        default-position="right-2 bottom-2"
      />
    </div>

    <!-- Info -->
    <div class="flex min-w-0 flex-1 flex-col overflow-y-auto px-8 py-7">
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <div
            class="flex h-6 items-center gap-1 rounded-md bg-zinc-700/50 px-2"
          >
            <i
              :class="
                isApp ? 'icon-[lucide--app-window]' : 'icon-[comfy--workflow]'
              "
              class="size-3 text-white"
            />
            <span class="text-xs font-medium whitespace-nowrap text-white">
              {{
                isApp
                  ? $t('builderToolbar.app')
                  : $t('builderToolbar.nodeGraph')
              }}
            </span>
          </div>
          <Tag
            v-if="template.openSource === false"
            :label="$t('templateWorkflows.detail.apiNodes')"
            shape="square"
            class="bg-charcoal-500/50 opacity-80"
          />
        </div>
        <Button
          :aria-label="$t('g.close')"
          variant="muted-textonly"
          size="icon"
          @click="close"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>

      <h2 class="mt-4 mb-0 text-xl/snug font-semibold">
        {{ title }}
      </h2>

      <p
        v-if="description"
        class="mt-2.5 mb-0 text-sm/relaxed text-muted-foreground"
      >
        {{ description }}
      </p>

      <!-- Readiness (PM-243): state pill + why. The card carries the signal;
           this block carries the reason. -->
      <div
        class="mt-5 rounded-lg border border-border-subtle bg-secondary-background/50 p-4"
        data-testid="template-readiness"
      >
        <span
          :class="
            cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
              readinessStyle.pill
            )
          "
        >
          <span :class="cn('size-1.5 rounded-full', readinessStyle.dot)" />
          {{ $t(`templateWorkflows.readiness.${readiness.state}`) }}
        </span>
        <p class="mt-2 mb-0 text-sm text-muted-foreground">
          {{ $t(`templateWorkflows.readiness.reason.${readiness.reasonKey}`) }}
        </p>
      </div>

      <div v-if="template.tags?.length" class="mt-5 flex flex-wrap gap-2">
        <Tag
          v-for="tag in template.tags"
          :key="tag"
          :label="tag"
          shape="square"
          class="bg-charcoal-500/50 opacity-80"
        />
      </div>

      <dl v-if="metaFields.length" class="mt-6 mb-0 flex flex-col gap-3">
        <div
          v-for="field in metaFields"
          :key="field.label"
          class="flex items-baseline gap-4 text-sm"
        >
          <dt class="w-40 shrink-0 text-muted-foreground">
            {{ field.label }}
          </dt>
          <dd class="m-0 min-w-0 flex-1">
            <div v-if="field.chips" class="flex flex-wrap gap-1.5">
              <Tag
                v-for="chip in field.chips"
                :key="chip"
                :label="chip"
                shape="square"
                class="max-w-full bg-charcoal-500/50 opacity-80"
              />
            </div>
            <template v-else>{{ field.value }}</template>
          </dd>
        </div>
      </dl>

      <div
        class="-mx-8 mt-8 flex items-center justify-end gap-3 border-t border-border-subtle px-8 pt-5 md:mt-auto"
      >
        <Button
          v-if="template.tutorialUrl"
          variant="secondary"
          @click="openTutorial"
        >
          <i class="icon-[lucide--graduation-cap] size-4" />
          {{ $t('g.seeTutorial') }}
        </Button>
        <Button
          variant="inverted"
          :disabled="isUsing"
          data-testid="template-detail-use"
          @click="onUseClick"
        >
          <ProgressSpinner v-if="isUsing" class="size-4" />
          {{ $t('templateWorkflows.detail.useTemplate') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Tag from '@/components/chip/Tag.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import Button from '@/components/ui/button/Button.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { isAppTemplate } from '@/platform/workflow/templates/utils/templateDisplay'
import { getTemplateReadiness } from '@/platform/workflow/templates/utils/templateReadiness'
import type { TemplateReadinessState } from '@/platform/workflow/templates/utils/templateReadiness'
import { useDialogStore } from '@/stores/dialogStore'
import { formatSize } from '@/utils/formatUtil'
import { cn } from '@comfyorg/tailwind-utils'

const props = defineProps<{
  template: TemplateInfo
  sourceModule: string
  dialogKey: string
  /** Loads the template; the surface that opened the detail owns telemetry and cleanup. */
  onUse: () => Promise<unknown> | unknown
}>()

const { t } = useI18n()
const workflowTemplatesStore = useWorkflowTemplatesStore()
const dialogStore = useDialogStore()
const { getTemplateThumbnailUrl, getTemplateTitle, getTemplateDescription } =
  useTemplateWorkflows()

const isApp = computed(() => isAppTemplate(props.template))

const readiness = computed(() => getTemplateReadiness(props.template))

// Palette mirrors the PM-243 proposal: green=ready, blue=download, amber=config.
const READINESS_STYLES: Record<
  TemplateReadinessState,
  { pill: string; dot: string }
> = {
  ready: {
    pill: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-300'
  },
  requiresDownload: {
    pill: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    dot: 'bg-sky-300'
  },
  needsConfiguration: {
    pill: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-300'
  },
  unverified: {
    pill: 'border-border-subtle bg-transparent text-muted-foreground',
    dot: 'bg-muted-foreground'
  }
}

const readinessStyle = computed(() => READINESS_STYLES[readiness.value.state])

const title = computed(() =>
  getTemplateTitle(props.template, props.sourceModule)
)
const description = computed(() => getTemplateDescription(props.template))

const isVideoMedia = computed(
  () =>
    props.template.mediaType === 'video' ||
    props.template.mediaSubtype === 'webp'
)

const thumbnailIndex = (index: string) =>
  props.sourceModule === 'default' ? index : ''

const baseThumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(
    props.template,
    props.sourceModule,
    thumbnailIndex('1')
  )
)
const overlayThumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(
    props.template,
    props.sourceModule,
    thumbnailIndex('2')
  )
)

interface MetaField {
  label: string
  value?: string
  chips?: string[]
}

const metaFields = computed<MetaField[]>(() => {
  const { models, size, vram, useCase, license, date, requiresCustomNodes } =
    props.template
  const fields: MetaField[] = []

  if (models?.length) {
    fields.push({
      label: t('templateWorkflows.detail.models'),
      chips: models
    })
  }
  if (size) {
    fields.push({
      label: t('templateWorkflows.detail.modelSize'),
      value: formatSize(size)
    })
  }
  if (vram) {
    fields.push({
      label: t('templateWorkflows.detail.vram'),
      value: formatSize(vram)
    })
  }
  if (useCase) {
    fields.push({
      label: t('templateWorkflows.detail.useCase'),
      value: useCase
    })
  }
  if (license) {
    fields.push({
      label: t('templateWorkflows.detail.license'),
      value: license
    })
  }
  if (date) {
    fields.push({ label: t('templateWorkflows.detail.published'), value: date })
  }
  if (requiresCustomNodes?.length) {
    fields.push({
      label: t('templateWorkflows.detail.customNodes'),
      chips: requiresCustomNodes
    })
  }
  return fields
})

const isUsing = ref(false)

const onUseClick = async () => {
  isUsing.value = true
  try {
    await props.onUse()
  } finally {
    isUsing.value = false
  }
}

const close = () => {
  dialogStore.closeDialog({ key: props.dialogKey })
}

const openTutorial = () => {
  if (props.template.tutorialUrl) {
    window.open(props.template.tutorialUrl, '_blank')
  }
}
</script>

<style scoped>
/* The shared thumbnails size themselves as square cards (BaseThumbnail is
 * aspect-square, images can letterbox via object-contain/max-h caps). In the
 * detail hero the media column stretches to the info column's height, which
 * left an empty band under the media. Make the thumbnail fill the column and
 * cover it edge to edge; scoped here so card grids keep their behavior. */
.template-detail-media :deep([class*='aspect-square']) {
  height: 100%;
  aspect-ratio: auto;
  border-radius: 0;
}

.template-detail-media :deep(img),
.template-detail-media :deep(video) {
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: cover;
}
</style>
