<template>
  <div :class="wrapperClasses">
    <CardContainer
      :ratio="dense ? 'smallSquare' : 'square'"
      tabindex="0"
      role="button"
      :aria-label="`Text: ${asset.name}`"
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
            </div>

            <JobIdSection
              v-if="context === 'output' && asset.jobId"
              :job-id="asset.jobId"
              @copy="handleCopyJobId"
            />

            <div :class="actionButtonsClasses">
              <IconButton
                :class="actionButtonClasses"
                aria-label="View text"
                size="sm"
                type="transparent"
                :on-click="handleView"
              >
                <i :class="iconClasses('pi-eye')" />
              </IconButton>
              <IconButton
                :class="actionButtonClasses"
                aria-label="Copy text"
                size="sm"
                type="transparent"
                :on-click="handleCopy"
              >
                <i :class="iconClasses('pi-copy')" />
              </IconButton>
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
  copy: [assetId: string]
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

function handleCardClick() {
  emit('openDetail', props.asset.id)
}

function handleView(event: Event) {
  event.stopPropagation()
  emit('view', props.asset.id)
}

function handleCopy(event: Event) {
  event.stopPropagation()
  emit('copy', props.asset.id)
}

function handleCopyJobId() {
  if (props.asset.jobId) {
    emit('copyJobId', props.asset.jobId)
  }
}
</script>
