<template>
  <div
    :key="listKey"
    :style="gridStyle"
    data-testid="template-workflows-content"
  >
    <slot name="prepend" />

    <!-- Loading Skeletons (show while loading initial data) -->
    <CardContainer
      v-for="n in isLoading ? 12 : 0"
      :key="`initial-skeleton-${n}`"
      size="compact"
      variant="ghost"
      rounded="lg"
      class="hover:bg-base-background"
    >
      <template #top>
        <CardTop ratio="landscape">
          <template #default>
            <div class="size-full animate-pulse bg-dialog-surface"></div>
          </template>
        </CardTop>
      </template>
      <template #bottom>
        <CardBottom>
          <div class="px-4 py-3">
            <div
              class="mb-2 h-6 animate-pulse rounded-sm bg-dialog-surface"
            ></div>
            <div class="h-4 animate-pulse rounded-sm bg-dialog-surface"></div>
          </div>
        </CardBottom>
      </template>
    </CardContainer>

    <!-- Actual Template Cards -->
    <CardContainer
      v-for="template in isLoading ? [] : templates"
      v-show="isTemplateVisible(template)"
      :key="template.name"
      size="tall"
      variant="ghost"
      rounded="lg"
      :data-testid="`template-workflow-${template.name}`"
      :has-cursor="interactive"
      class="hover:bg-base-background"
      @mouseenter="interactive && emit('mouseenter', template)"
      @mouseleave="interactive && emit('mouseleave')"
      @click="interactive && emit('select', template)"
    >
      <template #top>
        <CardTop ratio="square">
          <template #default>
            <div class="relative size-full overflow-hidden rounded-lg">
              <template v-if="template.mediaType === 'audio'">
                <AudioThumbnail :src="getBaseThumbnailSrc(template)" />
              </template>
              <template
                v-else-if="template.thumbnailVariant === 'compareSlider'"
              >
                <CompareSliderThumbnail
                  :base-image-src="getBaseThumbnailSrc(template)"
                  :overlay-image-src="getOverlayThumbnailSrc(template)"
                  :alt="
                    getTemplateTitle(
                      template,
                      getEffectiveSourceModule(template)
                    )
                  "
                  :is-hovered="hoveredTemplateName === template.name"
                  :is-video="
                    template.mediaType === 'video' ||
                    template.mediaSubtype === 'webp'
                  "
                />
              </template>
              <template
                v-else-if="template.thumbnailVariant === 'hoverDissolve'"
              >
                <HoverDissolveThumbnail
                  :base-image-src="getBaseThumbnailSrc(template)"
                  :overlay-image-src="getOverlayThumbnailSrc(template)"
                  :alt="
                    getTemplateTitle(
                      template,
                      getEffectiveSourceModule(template)
                    )
                  "
                  :is-hovered="hoveredTemplateName === template.name"
                  :is-video="
                    template.mediaType === 'video' ||
                    template.mediaSubtype === 'webp'
                  "
                />
              </template>
              <template v-else>
                <DefaultThumbnail
                  :src="getBaseThumbnailSrc(template)"
                  :alt="
                    getTemplateTitle(
                      template,
                      getEffectiveSourceModule(template)
                    )
                  "
                  :is-hovered="hoveredTemplateName === template.name"
                  :is-video="
                    template.mediaType === 'video' ||
                    template.mediaSubtype === 'webp'
                  "
                  :hover-zoom="
                    template.thumbnailVariant === 'zoomHover' ? 16 : 5
                  "
                />
              </template>
              <LogoOverlay
                v-if="template.logos?.length"
                :logos="template.logos"
                :get-logo-url="workflowTemplatesStore.getLogoUrl"
              />
              <ProgressSpinner
                v-if="loadingTemplateName === template.name"
                class="absolute inset-0 z-10 m-auto size-12"
              />
            </div>
          </template>
          <template #bottom-right>
            <template v-if="template.tags?.length">
              <SquareChip
                v-for="tag in template.tags"
                :key="tag"
                :label="tag"
              />
            </template>
          </template>
        </CardTop>
      </template>
      <template #bottom>
        <CardBottom>
          <div class="flex flex-col gap-2 pt-3">
            <h3
              class="m-0 line-clamp-1 text-sm"
              :title="
                getTemplateTitle(template, getEffectiveSourceModule(template))
              "
            >
              {{
                getTemplateTitle(template, getEffectiveSourceModule(template))
              }}
            </h3>
            <div class="flex justify-between gap-2">
              <div class="flex-1">
                <p
                  class="m-0 line-clamp-2 text-sm text-muted"
                  :title="getTemplateDescription(template)"
                >
                  {{ getTemplateDescription(template) }}
                </p>
              </div>
              <div
                v-if="template.tutorialUrl"
                class="flex flex-col-reverse justify-center"
              >
                <slot
                  name="tutorial-button"
                  :template="template"
                  :is-hovered="hoveredTemplateName === template.name"
                >
                  <Button
                    v-if="hoveredTemplateName === template.name"
                    v-tooltip.bottom="$t('g.seeTutorial')"
                    variant="inverted"
                    size="icon"
                    @click.stop="openTutorial(template)"
                  >
                    <i class="icon-[lucide--info] size-4" />
                  </Button>
                </slot>
              </div>
            </div>
            <div class="flex">
              <span
                class="text-neutral flex items-center gap-1.5 text-xs font-bold"
              >
                <template v-if="template.name.endsWith('.app')">
                  <i class="icon-[lucide--panels-top-left]" />
                  {{ $t('builderToolbar.app', 'App') }}
                </template>
                <template v-else>
                  <i class="icon-[lucide--workflow]" />
                  {{ $t('builderToolbar.nodeGraph', 'Node Graph') }}
                </template>
              </span>
            </div>
          </div>
        </CardBottom>
      </template>
    </CardContainer>

    <!-- Loading More Skeletons -->
    <CardContainer
      v-for="n in isLoadingMore ? 6 : 0"
      :key="`skeleton-${n}`"
      size="compact"
      variant="ghost"
      rounded="lg"
      class="hover:bg-base-background"
    >
      <template #top>
        <CardTop ratio="square">
          <template #default>
            <div class="size-full animate-pulse bg-dialog-surface"></div>
          </template>
        </CardTop>
      </template>
      <template #bottom>
        <CardBottom>
          <div class="px-4 py-3">
            <div
              class="mb-2 h-6 animate-pulse rounded-sm bg-dialog-surface"
            ></div>
            <div class="h-4 animate-pulse rounded-sm bg-dialog-surface"></div>
          </div>
        </CardBottom>
      </template>
    </CardContainer>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed } from 'vue'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import Button from '@/components/ui/button/Button.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { createGridStyle } from '@/utils/gridUtil'

const props = defineProps<{
  templates: TemplateInfo[]
  isLoading: boolean
  isLoadingMore: boolean
  loadingTemplateName: string | null
  hoveredTemplateName: string | null
  listKey?: number
  distributions?: TemplateIncludeOnDistributionEnum[]
  interactive?: boolean
}>()

const interactive = computed(() => props.interactive ?? true)

const emit = defineEmits<{
  (e: 'select', template: TemplateInfo): void
  (e: 'mouseenter', template: TemplateInfo): void
  (e: 'mouseleave'): void
}>()

const workflowTemplatesStore = useWorkflowTemplatesStore()
const { getTemplateThumbnailUrl, getTemplateTitle, getTemplateDescription } =
  useTemplateWorkflows()

const systemStatsStore = useSystemStatsStore()
const distributions = computed(() => {
  if (props.distributions?.length) return props.distributions
  switch (__DISTRIBUTION__) {
    case 'cloud':
      return [TemplateIncludeOnDistributionEnum.Cloud]
    case 'localhost':
      return [TemplateIncludeOnDistributionEnum.Local]
    case 'desktop':
    default:
      if (systemStatsStore.systemStats?.system.os === 'darwin') {
        return [
          TemplateIncludeOnDistributionEnum.Desktop,
          TemplateIncludeOnDistributionEnum.Mac
        ]
      }
      return [
        TemplateIncludeOnDistributionEnum.Desktop,
        TemplateIncludeOnDistributionEnum.Windows
      ]
  }
})

const gridStyle = computed(() => createGridStyle())

function getEffectiveSourceModule(template: TemplateInfo) {
  return template.sourceModule || 'default'
}

function getBaseThumbnailSrc(template: TemplateInfo) {
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '1' : '')
}

function getOverlayThumbnailSrc(template: TemplateInfo) {
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '2' : '')
}

function openTutorial(template: TemplateInfo) {
  if (template.tutorialUrl) {
    window.open(template.tutorialUrl, '_blank')
  }
}

function isTemplateVisible(template: TemplateInfo) {
  return (template.includeOnDistributions?.length ?? 0) > 0
    ? distributions.value.some((d) =>
        template.includeOnDistributions?.includes(d)
      )
    : true
}
</script>
