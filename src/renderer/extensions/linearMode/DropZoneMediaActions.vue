<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import ImageLightbox from '@comfyorg/design-system/media/ImageLightbox'

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
    <Button
      v-if="onMaskEdit"
      variant="inverted"
      size="icon"
      :aria-label="t('maskEditor.openMaskEditor')"
      :title="t('maskEditor.openMaskEditor')"
      @click.stop="onMaskEdit()"
    >
      <i class="icon-[comfy--mask]" />
    </Button>
    <Button
      variant="inverted"
      size="icon"
      :aria-label="t('mediaAsset.actions.zoom')"
      :title="t('mediaAsset.actions.zoom')"
      @click.stop="lightboxOpen = true"
    >
      <i class="icon-[lucide--zoom-in]" />
    </Button>
  </div>
  <ImageLightbox
    v-model="lightboxOpen"
    :src="mediaUrl"
    :alt="label ?? ''"
    :fallback-title="$t('g.imageLightbox')"
    :close-label="$t('g.close')"
  />
</template>
