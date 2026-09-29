<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MediaLightbox from '@/components/common/MediaLightbox.vue'
import type { LightboxImageItem } from '@/types/lightboxItem'

const { mediaUrl, label, onMaskEdit } = defineProps<{
  mediaUrl: string
  label?: string
  onMaskEdit?: () => void
}>()

const { t } = useI18n()
const lightboxIndex = ref<number | null>(null)
const lightboxItems = computed<LightboxImageItem[]>(() => [
  { kind: 'image', url: mediaUrl, alt: label ?? '' }
])
</script>
<template>
  <div
    class="absolute top-2 right-5 z-10 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within/dropzone:opacity-100 group-hover/dropzone:opacity-100"
  >
    <button
      v-if="onMaskEdit"
      type="button"
      :aria-label="t('maskEditor.openMaskEditor')"
      :title="t('maskEditor.openMaskEditor')"
      class="flex cursor-pointer items-center justify-center rounded-lg bg-base-foreground p-2 text-base-background transition-colors hover:bg-base-foreground/90"
      @click.stop="onMaskEdit()"
    >
      <i class="icon-[comfy--mask] size-4" />
    </button>
    <button
      type="button"
      :aria-label="t('mediaAsset.actions.zoom')"
      :title="t('mediaAsset.actions.zoom')"
      class="flex cursor-pointer items-center justify-center rounded-lg bg-base-foreground p-2 text-base-background transition-colors hover:bg-base-foreground/90"
      @click.stop="lightboxIndex = 0"
    >
      <i class="icon-[lucide--zoom-in] size-4" />
    </button>
  </div>
  <MediaLightbox v-model:active-index="lightboxIndex" :items="lightboxItems" />
</template>
