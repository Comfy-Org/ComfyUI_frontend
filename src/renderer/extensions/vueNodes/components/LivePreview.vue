<template>
  <template v-if="imageUrl">
    <div
      v-if="imageError"
      class="text-pure-white flex size-full flex-col items-center justify-center text-center"
    >
      <i-lucide:image-off class="mb-1 size-8 text-smoke-500" />
      <p class="text-xs text-smoke-400">{{ $t('g.imageFailedToLoad') }}</p>
    </div>
    <img
      v-else
      :src="imageUrl"
      :alt="$t('g.liveSamplingPreview')"
      class="pointer-events-none min-h-55 w-full flex-1 object-contain contain-size"
    />
    <div class="text-node-component-header-text mt-1 text-center text-xs">
      {{
        imageError
          ? $t('g.errorLoadingImage')
          : actualDimensions || $t('g.calculatingDimensions')
      }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface LivePreviewProps {
  imageUrl: string
}

const props = defineProps<LivePreviewProps>()

const { t } = useI18n()

const {
  state: imageState,
  isReady,
  error
} = useImage(
  computed(() => ({ src: props.imageUrl, alt: t('g.liveSamplingPreview') }))
)

// Cache last successfully loaded dimensions so the placeholder text does not
// flicker back to "Calculating dimensions" each time `imageUrl` changes during
// live preview streaming. Update only when a new image is ready, never on
// URL change alone.
const cachedWidth = ref<number | null>(null)
const cachedHeight = ref<number | null>(null)

watch([isReady, imageState], ([ready, img]) => {
  if (!ready || !img) return
  if (img.naturalWidth && img.naturalHeight) {
    cachedWidth.value = img.naturalWidth
    cachedHeight.value = img.naturalHeight
  }
})

const imageError = computed(() => !!error.value)

const actualDimensions = computed(() =>
  cachedWidth.value && cachedHeight.value
    ? `${cachedWidth.value} x ${cachedHeight.value}`
    : null
)
</script>
