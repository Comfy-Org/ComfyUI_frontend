<script setup lang="ts">
import FeatureRows01 from '../../components/blocks/FeatureRows01.vue'
import type { FeatureRow } from '../../components/blocks/FeatureRows01.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type ToolMedia =
  | { type: 'image'; src: string }
  | {
      type: 'video'
      src: string
      autoplay?: boolean
      loop?: boolean
      hideControls?: boolean
    }

const tools: {
  n: 1 | 2 | 3 | 4 | 5 | 6
  media: ToolMedia
  altKey?: TranslationKey
}[] = [
  {
    n: 1,
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/mcp/generate-everything.gif'
    },
    altKey: 'mcp.tools.1.alt'
  },
  {
    n: 2,
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/mcp/search-ecosystem.png'
    },
    altKey: 'mcp.tools.2.alt'
  },
  {
    n: 3,
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/mcp/run-real-workflows.mp4',
      autoplay: true,
      loop: true,
      hideControls: true
    },
    altKey: 'mcp.tools.3.alt'
  },
  {
    n: 4,
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/mcp/direct-any-model.png'
    },
    altKey: 'mcp.tools.4.alt'
  },
  {
    n: 5,
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/mcp/generate-in-batches.png'
    },
    altKey: 'mcp.tools.5.alt'
  },
  {
    n: 6,
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/mcp/ship-it-app-mode.png'
    },
    altKey: 'mcp.tools.6.alt'
  }
]

const rows: FeatureRow[] = tools.map(({ n, media, altKey }) => {
  const alt = altKey ? t(altKey, locale) : undefined
  return {
    id: String(n),
    title: t(`mcp.tools.${n}.title`, locale),
    description: t(`mcp.tools.${n}.description`, locale),
    media: { ...media, alt }
  }
})
</script>

<template>
  <FeatureRows01
    :locale="locale"
    :heading="t('mcp.tools.heading', locale)"
    :rows="rows"
  />
</template>
