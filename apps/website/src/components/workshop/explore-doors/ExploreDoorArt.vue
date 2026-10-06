<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import type { DoorArt, HubDoor } from '@/lib/workshop/explore-art'
import DoorAppPanel from '@/components/workshop/explore-doors/DoorAppPanel.vue'
import DoorModelPanel from '@/components/workshop/explore-doors/DoorModelPanel.vue'
import DoorWorkflowPanel from '@/components/workshop/explore-doors/DoorWorkflowPanel.vue'

const {
  section,
  art,
  artColumn,
  stage,
  locale = 'en'
} = defineProps<{
  section: HubDoor
  art: DoorArt
  artColumn: string
  stage: string
  locale?: Locale
}>()

const src = computed(() => art[section]?.src)
</script>

<template>
  <span
    :class="cn('relative w-2/5', artColumn)"
    aria-hidden="true"
    data-testid="explore-door-art"
  >
    <span :class="cn('absolute top-6 right-0 bottom-0 left-0', stage)">
      <span
        class="absolute inset-0 overflow-hidden rounded-tl-2xl ring-1 ring-primary-warm-white/20"
      >
        <img
          :src
          alt=""
          class="size-full object-cover select-none group-hover:scale-105 motion-safe:transition-transform motion-safe:duration-700"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <span
          class="absolute inset-0 group-hover:bg-black/20 motion-safe:transition-colors motion-safe:duration-500"
        />
      </span>

      <DoorModelPanel
        v-if="section === 'models' && art.models"
        :model="art.models"
        :locale
      />
      <DoorWorkflowPanel v-else-if="section === 'workflows'" :locale />
      <DoorAppPanel
        v-else-if="section === 'apps' && art.apps"
        :app="art.apps"
        :locale
      />
    </span>
  </span>
</template>
