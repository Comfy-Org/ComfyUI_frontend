<template>
  <div :class="wrapperClasses">
    <CardContainer
      :ratio="dense ? 'smallSquare' : 'square'"
      tabindex="0"
      role="button"
      :aria-label="`Audio: ${asset.name}`"
      :class="cardClasses"
      @click="handleCardClick"
      @keydown.enter="handleCardClick"
      @keydown.space.prevent="handleCardClick"
    >
      <template #top>
        <CardTop ratio="square">
          <QueueAssetThumbnail :asset="asset" :show-badge="true" />
        </CardTop>
      </template>
      <template #bottom>
        <CardBottom>
          <div class="flex flex-col gap-2 pt-3">
            <h3
              class="m-0 line-clamp-1 text-sm font-medium"
              :title="asset.name"
            >
              {{ asset.name }}
            </h3>

            <div :class="metaTextClasses">
              <span>{{ formatSize(asset.size) }}</span>
              <span v-if="asset.duration">
                <i class="pi pi-clock mr-1 text-xs" />
                {{ formatDuration(asset.duration) }}
              </span>
            </div>

            <JobIdSection
              v-if="context === 'output' && asset.jobId"
              :job-id="asset.jobId"
              @copy="handleCopyJobId"
            />

            <div :class="actionButtonsClasses">
              <IconButton
                :class="actionButtonClasses"
                aria-label="Play audio"
                size="sm"
                type="transparent"
                :on-click="handlePlay"
              >
                <i :class="iconClasses('pi-play')" />
              </IconButton>
              <IconButton
                :class="actionButtonClasses"
                aria-label="Download audio"
                size="sm"
                type="transparent"
                :on-click="handleDownload"
              >
                <i :class="iconClasses('pi-download')" />
              </IconButton>
            </div>
          </div>
        </CardBottom>
      </template>
    </CardContainer>
  </div>
</template>

<script setup lang="ts">
import QueueAssetThumbnail from '@/components/assetLibrary/MediaAssetThumbnail.vue'
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
  play: [assetId: string]
  download: [assetId: string]
  copyJobId: [jobId: string]
  openDetail: [assetId: string]
}>()

// Static classes using cn()
const wrapperClasses = cn('group', 'transition-all duration-200')

const cardClasses = cn('w-full', 'shadow-none border-0')

const metaTextClasses = cn(
  'flex items-center gap-2',
  'text-xs',
  'text-gray-500 dark-theme:text-gray-400'
)

const actionButtonsClasses = cn(
  'flex gap-1 mt-auto',
  'opacity-0 group-hover:opacity-100',
  'transition-opacity duration-200'
)

const actionButtonClasses = cn(
  'flex-1 p-1.5 text-xs',
  'hover:bg-gray-100 dark-theme:hover:bg-gray-700',
  'rounded',
  'transition-all hover:scale-105'
)

const iconClasses = (iconName: string) =>
  cn('pi', iconName, 'text-gray-500 dark-theme:text-gray-400')

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function handleCardClick() {
  emit('openDetail', props.asset.id)
}

function handlePlay(event: Event) {
  event.stopPropagation()
  emit('play', props.asset.id)
}

function handleDownload(event: Event) {
  event.stopPropagation()
  emit('download', props.asset.id)
}

function handleCopyJobId() {
  if (props.asset.jobId) {
    emit('copyJobId', props.asset.jobId)
  }
}
</script>
