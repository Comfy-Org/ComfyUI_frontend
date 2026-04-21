<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import GalleryCard from './GalleryCard.vue'
import GalleryDetailModal from './GalleryDetailModal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const modalOpen = ref(false)
const modalIndex = ref(0)

function openDetail(index: number) {
  modalIndex.value = index
  modalOpen.value = true
}

export interface GalleryItem {
  image?: string
  video?: string
  title: string
  userAlias: string
  teamAlias: string
  tool: string
  href?: string
}

const items: GalleryItem[] = [
  {
    video: 'https://media.comfy.org/videos/compressed_512/eye.webm',
    title: 'Until Our Eye Interlink harajuku',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'ThinkDiffusion',
    tool: 'ComfyUI',
    href: 'https://www.thinkdiffusion.com/studio#success-stories-anta'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/kyrie.webm',
    title: 'Origins - Kyrie Irving',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'ThinkDiffusion',
    tool: 'ComfyUI',
    href: 'https://vimeo.com/1021360563'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/arcade.webm',
    title: 'Neon Nights',
    userAlias: 'ShaneF Motion Design',
    teamAlias: 'DOGSTUDIO/DEPT®',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/p/C1kG1oErzUV/'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/dusk_mountains.webm',
    title: 'Untitled',
    userAlias: 'MidJourney man',
    teamAlias: 'DOGSTUDIO/DEPT®',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/midjourney.man/?hl=fr'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/cigarette.webm',
    title: 'Autopoiesis',
    userAlias: 'Yogo',
    teamAlias: 'Visual Frisson',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/visualfrisson/?hl=en'
  },
  {
    video:
      'https://media.comfy.org/videos/compressed_512/Eat%20It%20-%20Dance%20%5BWanAnimate%5D2.webm',
    title: 'Eat It - Dance',
    userAlias: 'Johana Lyu',
    teamAlias: 'Visual Frisson',
    tool: 'ComfyUI',
    href: 'https://www.joannalyu.com/'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/flower.webm',
    title: 'Fall',
    userAlias: 'Nathan Shipley',
    teamAlias: 'Visual Frisson',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/p/C3k9t_6vH5F/'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/buildings.webm',
    title: 'Untitled',
    userAlias: 'Nathan Shipley',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/p/C6rEuJ4p9xU/'
  },
  {
    video:
      'https://media.comfy.org/videos/compressed_512/origami_shortened.webm',
    title: 'Origami world',
    userAlias: 'Karen X',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/karenxcheng/'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/biking.webm',
    title: 'Shot on InstaX',
    userAlias: 'Karen X',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.instagram.com/karenxcheng/'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/clouds.webm',
    title: "It's gonna be a good good summer",
    userAlias: 'Paul Trillo',
    teamAlias: '',
    tool: 'CogvideoX',
    href: 'https://vimeo.com/1019685900'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/dududu.webm',
    title: 'DDU-DU DDU-DU',
    userAlias: 'Purz',
    teamAlias: 'Andidea',
    tool: 'Animatediff',
    href: 'https://vimeo.com/1019924290'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/paul_trillo.webm',
    title: 'Cuco - A Love Letter To LA',
    userAlias: 'Paul Trillo',
    teamAlias: 'CoffeeVectors',
    tool: 'ComfyUI',
    href: 'https://vimeo.com/1062859798'
  },
  {
    video:
      'https://media.comfy.org/videos/compressed_512/chibi_fish_tank_shortened.webm',
    title: 'Show you my garden',
    userAlias: 'Paul Trillo',
    teamAlias: '',
    tool: 'CogvideoX',
    href: 'https://vimeo.com/1019685479'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/swings.webm',
    title: 'Goodbye Beijing',
    userAlias: 'Rui',
    teamAlias: 'makeitrad',
    tool: 'Animatediff',
    href: 'https://x.com/rui40000'
  },
  {
    video: 'https://media.comfy.org/videos/compressed_512/clouds_statue.webm',
    title: 'Animation Reel',
    userAlias: 'Andidea',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://www.youtube.com/watch?v=qu3eIQ1uln8'
  },
  {
    image: 'https://media.comfy.org/website/gallery/gallery.webp',
    title: 'Amber Astronaut',
    userAlias: 'Yogo',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://de.linkedin.com/in/milan-kastenmueller-18778a174'
  },
  {
    image: 'https://media.comfy.org/website/gallery/desert.webp',
    title: 'Desert Landing',
    userAlias: 'Yogo',
    teamAlias: '',
    tool: 'ComfyUI',
    href: 'https://de.linkedin.com/in/milan-kastenmueller-18778a174'
  }
]

/**
 * Desktop layout pattern (repeating):
 *  Row A: full-width                           (1 item)
 *  Row B: 2-col equal                          (2 items)
 *  Row C: 3-col equal                          (3 items)
 *  Row D: large-left + 2 stacked small-right   (3 items)
 *  Row E: 2 stacked small-left + large-right   (3 items)
 *  = 1 + 2 + 3 + 3 + 3 = 12 items per cycle
 */
type RowLayout = 'full' | 'col-2' | 'col-3' | 'large-left' | 'large-right'
const LAYOUT_PATTERN: RowLayout[] = [
  'full',
  'col-2',
  'col-3',
  'large-left',
  'large-right'
]
const ITEMS_PER_LAYOUT: Record<RowLayout, number> = {
  full: 1,
  'col-2': 2,
  'col-3': 3,
  'large-left': 3,
  'large-right': 3
}

interface Row {
  layout: RowLayout
  items: GalleryItem[]
  startIndex: number
}

const rows: Row[] = []
let idx = 0
let patternIdx = 0

while (idx < items.length) {
  const layout = LAYOUT_PATTERN[patternIdx % LAYOUT_PATTERN.length]
  const count = ITEMS_PER_LAYOUT[layout]
  const slice = items.slice(idx, idx + count)
  if (slice.length === 0) break
  rows.push({ layout, items: slice, startIndex: idx })
  idx += slice.length
  patternIdx++
}
</script>

<template>
  <section class="px-4 pb-20 lg:px-20">
    <!-- Desktop grid -->
    <div
      class="rounded-5xl bg-transparency-white-t4 hidden flex-col gap-2 p-2 lg:flex"
    >
      <template v-for="(row, rowIdx) in rows" :key="rowIdx">
        <!-- Symmetric rows: full / 2-col / 3-col -->
        <div
          v-if="
            row.layout === 'full' ||
            row.layout === 'col-2' ||
            row.layout === 'col-3'
          "
          class="grid grid-cols-6 gap-2"
        >
          <GalleryCard
            v-for="(item, i) in row.items"
            :key="i"
            :item="item"
            :locale="locale"
            :aspect="row.layout === 'full' ? '16/9' : undefined"
            :class="
              cn(
                row.layout === 'full' && 'col-span-6',
                row.layout === 'col-2' && 'col-span-3',
                row.layout === 'col-3' && 'col-span-2'
              )
            "
            @click="openDetail(row.startIndex + i)"
          />
        </div>

        <!-- Large left + 2 stacked right -->
        <div
          v-else-if="row.layout === 'large-left'"
          class="grid grid-cols-2 gap-2"
        >
          <GalleryCard
            :item="row.items[0]"
            :locale="locale"
            aspect="3/4"
            class="row-span-2"
            @click="openDetail(row.startIndex)"
          />
          <div class="flex flex-col gap-2">
            <GalleryCard
              :item="row.items[1]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex + 1)"
            />
            <GalleryCard
              :item="row.items[2]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex + 2)"
            />
          </div>
        </div>

        <!-- 2 stacked left + large right -->
        <div v-else class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-2">
            <GalleryCard
              :item="row.items[0]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex)"
            />
            <GalleryCard
              :item="row.items[1]"
              :locale="locale"
              class="flex-1"
              @click="openDetail(row.startIndex + 1)"
            />
          </div>
          <GalleryCard
            :item="row.items[2]"
            :locale="locale"
            aspect="3/4"
            class="row-span-2"
            @click="openDetail(row.startIndex + 2)"
          />
        </div>
      </template>
    </div>

    <!-- Mobile list -->
    <div
      class="rounded-5xl bg-transparency-white-t4 flex flex-col gap-6 p-2 lg:hidden"
    >
      <GalleryCard
        v-for="(item, i) in items"
        :key="i"
        :item="item"
        :locale="locale"
        mobile
        @click="openDetail(i)"
      />
    </div>

    <GalleryDetailModal
      v-if="modalOpen"
      :items="items"
      :initial-index="modalIndex"
      :locale="locale"
      @close="modalOpen = false"
    />
  </section>
</template>
