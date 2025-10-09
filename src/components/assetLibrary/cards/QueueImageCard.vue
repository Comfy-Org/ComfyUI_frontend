<template>
  <div :class="wrapperClasses">
    <CardContainer
      :ratio="dense ? 'smallSquare' : 'square'"
      tabindex="0"
      role="button"
      :aria-label="`Image: ${asset.name}`"
      :class="cardClasses"
      @click="handleCardClick"
      @keydown.enter="handleCardClick"
      @keydown.space.prevent="handleCardClick"
    >
      <template #top>
        <CardTop ratio="square">
          <!-- Thumbnail image -->
          <div class="h-full w-full">
            <QueueAssetThumbnail :asset="asset" :show-badge="false" />
          </div>

          <template #top-left>
            <div
              class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <IconButton
                :class="iconButtonClasses"
                aria-label="View image"
                size="sm"
                type="transparent"
                :on-click="handleView"
              >
                <i class="pi pi-eye text-xs text-white" />
              </IconButton>
              <IconButton
                :class="iconButtonClasses"
                aria-label="Copy"
                size="sm"
                type="transparent"
                :on-click="handleCopy"
              >
                <i class="pi pi-copy text-xs text-white" />
              </IconButton>
              <IconButton
                :class="iconButtonClasses"
                aria-label="More options"
                size="sm"
                type="transparent"
                :on-click="handleMore"
              >
                <i class="pi pi-ellipsis-h text-xs text-white" />
              </IconButton>
            </div>
          </template>

          <template #top-right>
            <IconButton
              class="opacity-0 transition-opacity group-hover:opacity-100"
              :class="iconButtonClasses"
              aria-label="Download"
              size="sm"
              type="transparent"
              :on-click="handleDownload"
            >
              <i class="pi pi-download text-xs text-white" />
            </IconButton>
          </template>

          <template #bottom-left>
            <div v-if="asset.dimensions">
              <div
                class="flex items-center rounded bg-zinc-300/40 px-2 py-1 backdrop-blur-[2px]"
              >
                <span class="text-xs font-bold text-white">
                  {{ asset.dimensions.width }}×{{ asset.dimensions.height }}
                </span>
              </div>
            </div>
          </template>

          <template #bottom-right>
            <JobIdSection
              v-if="context === 'output' && asset.jobId"
              :job-id="asset.jobId"
              @copy="handleCopyJobId"
            />
          </template>
        </CardTop>
      </template>

      <template #bottom>
        <CardBottom class="px-0 pt-1 pb-0">
          <div class="flex flex-col items-start justify-start gap-1">
            <div
              class="inline-flex items-center justify-start gap-2.5 self-stretch rounded"
            >
              <h3
                class="line-clamp-1 flex-1 text-sm font-bold text-gray-900 dark-theme:text-gray-100"
                :title="asset.name"
              >
                {{ asset.name }}
              </h3>
            </div>
            <div
              class="inline-flex items-center justify-start gap-2 self-stretch"
            >
              <span
                class="flex-1 text-xs font-normal text-gray-600 dark-theme:text-gray-400"
              >
                {{ formatSize(asset.size) }}
              </span>
            </div>
          </div>
        </CardBottom>
      </template>
    </CardContainer>
  </div>
</template>

<script setup lang="ts">
import QueueAssetThumbnail from '@/components/assetLibrary/QueueAssetThumbnail.vue'
import JobIdSection from '@/components/assetLibrary/common/JobIdSection.vue'
import IconButton from '@/components/button/IconButton.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import type { AssetContext, AssetMeta } from '@/types/media.types'
import { formatSize } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  context: AssetContext
  asset: AssetMeta
  dense?: boolean
}>()

const emit = defineEmits<{
  view: [assetId: string]
  download: [assetId: string]
  copy: [assetId: string]
  copyJobId: [jobId: string]
  openDetail: [assetId: string]
  more: [assetId: string]
}>()

// Static classes using cn()
const wrapperClasses = cn('group', 'transition-all duration-200')

const cardClasses = cn('w-full', 'shadow-none border-0')

const iconButtonClasses = cn(
  'bg-black/60 backdrop-blur-sm',
  'hover:bg-black/80',
  '!rounded-lg'
)

function handleCardClick() {
  emit('openDetail', props.asset.id)
}

function handleView(event: Event) {
  event.stopPropagation()
  emit('view', props.asset.id)
}

function handleDownload(event: Event) {
  event.stopPropagation()
  emit('download', props.asset.id)
}

function handleCopy(event: Event) {
  event.stopPropagation()
  emit('copy', props.asset.id)
}

function handleMore(event: Event) {
  event.stopPropagation()
  emit('more', props.asset.id)
}

function handleCopyJobId() {
  if (props.asset.jobId) {
    emit('copyJobId', props.asset.jobId)
  }
}
</script>
