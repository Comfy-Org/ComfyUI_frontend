<template>
  <div class="flex gap-6 p-6">
    <div class="w-60 shrink-0">
      <CardContainer
        size="compact"
        variant="ghost"
        rounded="lg"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
        <template #top>
          <CardTop ratio="square">
            <div class="relative h-full w-full overflow-hidden rounded-lg">
              <CompareSliderThumbnail
                v-if="
                  wizardData.thumbnailVariant === 'compareSlider' &&
                  files.length === 2
                "
                :base-image-src="files[0]"
                :overlay-image-src="files[1]"
                alt="Preview"
                :is-hovered="isHovered"
                :is-video="true"
              />
              <HoverDissolveThumbnail
                v-else-if="
                  wizardData.thumbnailVariant === 'hoverDissolve' &&
                  files.length >= 2
                "
                :base-image-src="files[0]"
                :overlay-image-src="files[1]"
                alt="Preview"
                :is-hovered="isHovered"
                :is-video="true"
              />
              <DefaultThumbnail
                v-else-if="files.length > 0"
                :src="files[0]"
                alt="Preview"
                :hover-zoom="5"
                :is-hovered="isHovered"
                :is-video="true"
              />
              <div
                v-else
                class="flex size-full items-center justify-center bg-dialog-surface"
              >
                <i class="icon-[lucide--image] size-8 text-muted opacity-30" />
              </div>
            </div>
            <template v-if="wizardData.difficulty" #bottom-right>
              <SquareChip :label="wizardData.difficulty" />
            </template>
          </CardTop>
        </template>
        <template #bottom>
          <CardBottom>
            <div class="flex flex-col gap-2 pt-3">
              <h3 class="m-0 line-clamp-1 text-sm">
                {{ wizardData.title ?? wizardData.name }}
              </h3>
              <div
                v-if="wizardData.shortDescription"
                class="comfy-markdown-content m-0 line-clamp-2 text-sm text-muted"
                :title="wizardData.shortDescription"
                v-html="renderedShortDescription"
              />
            </div>
          </CardBottom>
        </template>
      </CardContainer>
    </div>

    <div class="flex flex-1 flex-col gap-4">
      <div
        class="flex flex-col gap-3 rounded-lg border border-border-default p-4 text-sm"
      >
        <div class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.difficulty')
          }}</span>
          <span>{{ wizardData.difficulty }}</span>
        </div>
        <div
          v-if="categories.length > 0"
          class="flex items-start justify-between"
        >
          <span class="text-muted">{{
            t('templateWorkflows.publish.categories')
          }}</span>
          <div class="flex flex-wrap justify-end gap-1">
            <SquareChip v-for="cat in categories" :key="cat" :label="cat" />
          </div>
        </div>
        <div v-if="tags.length > 0" class="flex items-start justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.tags')
          }}</span>
          <div class="flex flex-wrap justify-end gap-1">
            <SquareChip v-for="tag in tags" :key="tag" :label="tag" />
          </div>
        </div>
        <div v-if="wizardData.license" class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.license')
          }}</span>
          <span>{{
            t(`templateWorkflows.publish.licenses.${wizardData.license}`)
          }}</span>
        </div>
        <div
          v-if="customNodes.length > 0"
          class="flex items-start justify-between"
        >
          <span class="text-muted">{{
            t('templateWorkflows.publish.customNodes')
          }}</span>
          <div class="flex flex-wrap justify-end gap-1">
            <SquareChip v-for="node in customNodes" :key="node" :label="node" />
          </div>
        </div>
        <div
          v-if="requiredModels.length > 0"
          class="flex items-start justify-between"
        >
          <span class="text-muted">{{
            t('templateWorkflows.publish.requiredModels')
          }}</span>
          <div class="flex flex-wrap justify-end gap-1">
            <SquareChip
              v-for="model in requiredModels"
              :key="`${model.category}:${model.name}`"
              :label="`${model.category}/${model.name}`"
            />
          </div>
        </div>
        <div v-if="wizardData.vramEstimate" class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.vramEstimate')
          }}</span>
          <span>{{ formatSize(wizardData.vramEstimate) }}</span>
        </div>
        <div v-if="wizardData.tutorialUrl" class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.tutorialUrl')
          }}</span>
          <span class="truncate ml-4">{{ wizardData.tutorialUrl }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.version')
          }}</span>
          <span>{{ wizardData.version }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.mediaMode.label')
          }}</span>
          <span>{{ wizardData.thumbnailVariant ?? 'default' }}</span>
        </div>
        <div v-if="files.length > 0" class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.publish.mediaUpload')
          }}</span>
          <span>{{
            t(
              'templateWorkflows.publish.fileCount',
              { count: files.length },
              files.length
            )
          }}</span>
        </div>
        <div v-if="wizardData.changelog" class="flex flex-col gap-1">
          <span class="text-muted">{{
            t('templateWorkflows.publish.changelog')
          }}</span>
          <p class="m-0 whitespace-pre-wrap">{{ wizardData.changelog }}</p>
        </div>
      </div>

      <div
        v-if="wizardData.status"
        class="flex flex-col gap-3 rounded-lg border border-border-default p-4 text-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.myTemplates.statusLabel')
          }}</span>
          <StatusBadge
            :label="
              t(`templateWorkflows.myTemplates.status.${wizardData.status}`)
            "
            :severity="STATUS_SEVERITY[wizardData.status]"
          />
        </div>
        <p class="m-0 text-muted">
          {{
            t(
              `templateWorkflows.myTemplates.statusDescription.${wizardData.status}`
            )
          }}
        </p>
        <div
          v-if="wizardData.reviewFeedback"
          class="flex flex-col gap-1 rounded-md bg-dialog-surface p-3"
        >
          <span class="font-semibold">{{
            t('templateWorkflows.myTemplates.reviewFeedback')
          }}</span>
          <p class="m-0 whitespace-pre-wrap text-muted">
            {{ wizardData.reviewFeedback }}
          </p>
        </div>
        <div v-if="wizardData.createdAt" class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.myTemplates.createdAt')
          }}</span>
          <span>{{ formatDate(wizardData.createdAt) }}</span>
        </div>
        <div v-if="wizardData.updatedAt" class="flex justify-between">
          <span class="text-muted">{{
            t('templateWorkflows.myTemplates.updatedAt')
          }}</span>
          <span>{{ formatDate(wizardData.updatedAt) }}</span>
        </div>
        <Button
          v-if="wizardData.status !== 'draft'"
          variant="secondary"
          size="sm"
          :loading="isSaving"
          class="self-start"
          @click="revertToDraft"
        >
          <i class="icon-[lucide--undo-2] size-3.5" />
          {{ t('templateWorkflows.publish.revertToDraft') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import { formatSize } from '@/utils/formatUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'
import { STATUS_SEVERITY } from '../types/marketplace'

const { t } = useI18n()
const { wizardData, revertToDraft, isSaving } = usePublishTemplateWizard()

const files = computed(() => wizardData.value.gallery ?? [])
const categories = computed(() => wizardData.value.categories ?? [])
const tags = computed(() => wizardData.value.tags ?? [])
const customNodes = computed(() => wizardData.value.customNodes ?? [])
const requiredModels = computed(() => wizardData.value.requiredModels ?? [])
const renderedShortDescription = computed(() =>
  renderMarkdownToHtml(wizardData.value.shortDescription ?? '')
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}
const isHovered = ref(false)
</script>
