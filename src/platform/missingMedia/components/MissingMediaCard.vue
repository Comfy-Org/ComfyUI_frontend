<template>
  <div class="px-4 pb-2">
    <div
      v-for="group in missingMediaGroups"
      :key="group.mediaType"
      class="flex w-full flex-col border-t border-interface-stroke py-2 first:border-t-0 first:pt-0"
    >
      <!-- Media type header -->
      <div class="flex h-8 w-full items-center">
        <p
          class="min-w-0 flex-1 truncate text-sm font-medium text-destructive-background-hover"
        >
          <i
            aria-hidden="true"
            :class="mediaTypeIcon(group.mediaType)"
            class="mr-1 size-3.5 align-text-bottom"
          />
          {{ t(`rightSidePanel.missingMedia.${group.mediaType}`) }}
          ({{ group.items.length }})
        </p>
      </div>

      <!-- Media file rows -->
      <div class="flex flex-col gap-1 overflow-hidden pl-2">
        <MissingMediaRow
          v-for="item in group.items"
          :key="item.name"
          :item="item"
          :show-node-id-badge="showNodeIdBadge"
          @locate-node="emit('locateNode', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  MissingMediaGroup,
  MediaType
} from '@/platform/missingMedia/types'
import MissingMediaRow from '@/platform/missingMedia/components/MissingMediaRow.vue'

const { missingMediaGroups } = defineProps<{
  missingMediaGroups: MissingMediaGroup[]
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
}>()

const { t } = useI18n()

const MEDIA_TYPE_ICONS: Record<MediaType, string> = {
  image: 'icon-[lucide--image]',
  video: 'icon-[lucide--video]',
  audio: 'icon-[lucide--music]'
}

function mediaTypeIcon(mediaType: MediaType): string {
  return MEDIA_TYPE_ICONS[mediaType]
}
</script>
