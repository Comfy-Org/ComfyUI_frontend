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
                  template?.thumbnailVariant === 'compareSlider' &&
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
                  template?.thumbnailVariant === 'hoverDissolve' &&
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
                {{ template?.title ?? template?.name }}
              </h3>
              <p
                v-if="wizardData.shortDescription"
                class="m-0 line-clamp-2 text-sm text-muted"
                :title="wizardData.shortDescription"
              >
                {{ wizardData.shortDescription }}
              </p>
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
          <span>{{ template?.thumbnailVariant ?? 'default' }}</span>
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
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'

import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'

const { t } = useI18n()
const { wizardData } = usePublishTemplateWizard()

const template = computed(() => wizardData.value.template)
const files = computed(() => wizardData.value.gallery ?? [])
const isHovered = ref(false)
</script>
