<script setup lang="ts">
import { ref } from 'vue'

import type { GalleryItem } from '../../data/gallery'
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import GalleryCard from '../gallery/GalleryCard.vue'
import GalleryDetailModal from '../gallery/GalleryDetailModal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const modelName = 'Grok'
const ctaHref = 'https://comfy.org/workflows/model/grok'

const items: GalleryItem[] = [
  {
    id: 'subway-swan',
    image: 'https://media.comfy.org/website/gallery/subway-swan_compressed.png',
    title: 'Subway Swan',
    userAlias: 'Purz Beats',
    teamAlias: 'Comfy',
    tool: 'Grok Imagine',
    href: 'https://www.youtube.com/@PurzBeats'
  },
  {
    id: 'milos-little-wonder',
    video:
      'https://media.comfy.org/website/gallery/milos-little-wonder_compressed.mp4',
    title: 'Milos Little Wonder',
    userAlias: 'Purz Beats',
    teamAlias: 'Comfy',
    tool: 'Grok Imagine',
    href: 'https://www.youtube.com/@PurzBeats'
  },
  {
    id: 'amber-passage',
    image:
      'https://media.comfy.org/website/gallery/amber-passage_compressed.jpg',
    title: 'Amber Passage',
    userAlias: 'Purz Beats',
    teamAlias: 'Comfy',
    tool: 'Grok Imagine',
    href: 'https://www.youtube.com/@PurzBeats',
    objectPosition: 'bottom'
  },
  {
    id: 'neon-revenant',
    video:
      'https://media.comfy.org/website/gallery/neon-revenant_compressed.mp4',
    title: 'Neon Revenant',
    userAlias: 'Eric Solorio',
    teamAlias: 'Comfy',
    tool: 'Grok Imagine',
    href: 'https://www.instagram.com/enigmatic_e'
  },
  {
    id: 'midnight-umami',
    image:
      'https://media.comfy.org/website/gallery/midnight_umami_compressed.png',
    title: 'Midnight Umami',
    userAlias: 'Purz Beats',
    teamAlias: 'Comfy',
    tool: 'Grok Imagine',
    href: 'https://www.youtube.com/@PurzBeats'
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
    class="flex flex-col items-center px-4 py-16 lg:px-20 lg:pt-36"
  >
    <h2
      class="max-w-4xl text-center text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
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
          :object-position="item.objectPosition"
          :object-fit="item.objectFit"
          @click="openDetail(i)"
        />
      </div>
      <div v-if="items.length > 2" class="grid grid-cols-3 gap-2">
        <GalleryCard
          v-for="(item, i) in items.slice(2, 5)"
          :key="i + 2"
          :item
          :locale
          :object-position="item.objectPosition"
          :object-fit="item.objectFit"
          @click="openDetail(i + 2)"
        />
      </div>
    </div>

    <div
      class="rounded-5xl bg-transparency-white-t4 mt-12 flex w-full flex-col gap-6 p-2 max-lg:pb-6 lg:hidden"
    >
      <GalleryCard
        v-for="(item, i) in items"
        :key="i"
        :item
        :locale
        :object-position="item.objectPosition"
        :object-fit="item.objectFit"
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
