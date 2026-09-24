<template>
  <KeepAlive :max="RETAINED_VIDEO_COUNT" :include="RETAINED_COMPONENT">
    <component :is="rendered.is" :key="item.url" v-bind="rendered.props" />
  </KeepAlive>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import type { LightboxItem } from '@/types/lightboxItem'

import LightboxAudio from './LightboxAudio.vue'
import LightboxText from './LightboxText.vue'
import LightboxVideo from './LightboxVideo.vue'

const { item } = defineProps<{
  readonly item: LightboxItem
}>()

const RETAINED_VIDEO_COUNT = 3
const RETAINED_COMPONENT = 'LightboxVideo'
const IMAGE_CLASS = 'size-auto max-h-[90vh] max-w-[90vw] object-contain'

const rendered = computed<{
  is: Component
  props: Record<string, unknown>
}>(() => {
  switch (item.kind) {
    case 'image':
      return {
        is: ComfyImage,
        props: {
          src: item.url,
          contain: false,
          alt: item.alt ?? '',
          class: IMAGE_CLASS
        }
      }
    case 'video':
      return {
        is: LightboxVideo,
        props: {
          url: item.url,
          mimeType: item.mimeType,
          advancedPreviewUrl: item.advancedPreviewUrl
        }
      }
    case 'audio':
      return { is: LightboxAudio, props: { url: item.url } }
    case 'text':
      return {
        is: LightboxText,
        props: { url: item.url, content: item.content }
      }
    default: {
      const unhandledKind: never = item
      return unhandledKind
    }
  }
})
</script>
