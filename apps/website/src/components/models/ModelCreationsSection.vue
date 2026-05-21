<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { GalleryItem } from '../gallery/GallerySection.vue'

import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import GalleryCard from '../gallery/GalleryCard.vue'
import GalleryDetailModal from '../gallery/GalleryDetailModal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const modelName = 'Grok'
const ctaHref = 'https://comfy.org/workflows/model/grok'

const items: GalleryItem[] = [
  {
    video: 'https://media.comfy.org/videos/compressed_512/eye.webm',
    title: 'Until Our Eye Interlink harajuku',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'ThinkDiffusion',
    tool: 'Grok Imagine',
    href: 'https://www.thinkdiffusion.com/studio#success-stories-anta'
  },
  {
    image: 'https://media.comfy.org/website/gallery/gallery.webp',
    title: 'Amber Astronaut',
    userAlias: 'Yogo',
    teamAlias: '',
    tool: 'Grok Imagine',
    href: 'https://de.linkedin.com/in/milan-kastenmueller-18778a174'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/cigarette.webm',
    title: 'Autopoiesis',
    userAlias: 'Yogo',
    teamAlias: 'Visual Frisson',
    tool: 'Grok Imagine',
    href: 'https://www.instagram.com/visualfrisson/?hl=en'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/kyrie.webm',
    title: 'Origins',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'ThinkDiffusion',
    tool: 'Grok Imagine',
    href: 'https://vimeo.com/1021360563'
  },
  {
    image: 'https://media.comfy.org/website/gallery/desert.webp',
    title: 'Desert Landing',
    userAlias: 'Yogo',
    teamAlias: '',
    tool: 'Grok Imagine',
    href: 'https://de.linkedin.com/in/milan-kastenmueller-18778a174'
  }
]

const modalOpen = ref(false)
const modalIndex = ref(0)

function openDetail(index: number) {
  modalIndex.value = index
  modalOpen.value = true
}

const title = t('models.list.creations.title', locale).replace(
  '{name}',
  modelName
)
const ctaLabel = t('models.list.creations.cta', locale)
</script>

<template>
  <section
    data-testid="model-creations"
    class="flex flex-col items-center px-4 pt-12 pb-20 lg:px-20"
  >
    <h2
      class="text-primary-comfy-canvas max-w-4xl text-center text-3xl font-light tracking-tight lg:text-5xl"
    >
      {{ title }}
    </h2>
    <BrandButton
      :href="ctaHref"
      variant="solid"
      size="lg"
      class="mt-16 px-8 py-4 uppercase"
    >
      {{ ctaLabel }}
    </BrandButton>

    <div class="mt-20 hidden w-full flex-col gap-2 lg:flex">
      <div class="grid grid-cols-2 gap-2">
        <GalleryCard
          v-for="(item, i) in items.slice(0, 2)"
          :key="i"
          :item
          :locale
          @click="openDetail(i)"
        />
      </div>
      <div v-if="items.length > 2" class="grid grid-cols-3 gap-2">
        <GalleryCard
          v-for="(item, i) in items.slice(2, 5)"
          :key="i + 2"
          :item
          :locale
          @click="openDetail(i + 2)"
        />
      </div>
    </div>

    <div
      class="rounded-5xl bg-transparency-white-t4 mt-12 flex w-full flex-col gap-6 p-2 lg:hidden"
    >
      <GalleryCard
        v-for="(item, i) in items"
        :key="i"
        :item
        :locale
        mobile
        @click="openDetail(i)"
      />
    </div>

    <GalleryDetailModal
      v-if="modalOpen"
      :items
      :initial-index="modalIndex"
      :locale
      @close="modalOpen = false"
    />
  </section>
</template>
