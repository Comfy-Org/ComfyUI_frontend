<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ImageLightbox from '@/components/common/ImageLightbox.vue'

const { mediaUrl, label, onMaskEdit } = defineProps<{
  mediaUrl: string
  label?: string
  onMaskEdit?: () => void
}>()

const { t } = useI18n()
const lightboxOpen = ref(false)
</script>
<template>
  <div
    class="absolute top-2 right-5 z-10 flex gap-1 text-background opacity-0 transition-opacity duration-200 group-focus-within/dropzone:opacity-100 group-hover/dropzone:opacity-100"
  >
    <button
      v-if="onMaskEdit"
      type="button"
      :aria-label="t('maskEditor.openMaskEditor')"
      :title="t('maskEditor.openMaskEditor')"
      class="flex cursor-pointer items-center justify-center rounded-lg bg-foreground p-2 transition-colors hover:bg-foreground/90"
      @click.stop="onMaskEdit()"
    >
      <i class="icon-[comfy--mask]" />
    </button>
    <button
      type="button"
      :aria-label="t('mediaAsset.actions.zoom')"
      :title="t('mediaAsset.actions.zoom')"
      class="flex cursor-pointer items-center justify-center rounded-lg bg-foreground p-2 transition-colors hover:bg-foreground/90"
      @click.stop="lightboxOpen = true"
    >
      <i class="icon-[lucide--zoom-in]" />
    </button>
  </div>
  <ImageLightbox v-model="lightboxOpen" :src="mediaUrl" :alt="label ?? ''" />
</template>
