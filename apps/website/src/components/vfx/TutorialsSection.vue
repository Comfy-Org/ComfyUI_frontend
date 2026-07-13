<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { vfxTutorials } from '../../data/vfxTutorials'
import { t } from '../../i18n/translations'
import TutorialCard from '../common/TutorialCard.vue'
import TutorialDetailDialog from '../common/TutorialDetailDialog.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const activeTutorialId = ref<string | null>(null)
const activeTutorial = () =>
  vfxTutorials.find((tutorial) => tutorial.id === activeTutorialId.value)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-6 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl"
    >
      {{ t('vfx.tutorials.heading', locale) }}
    </h2>

    <p
      class="mx-auto mb-12 max-w-3xl text-center text-base text-primary-comfy-canvas lg:mb-16 lg:text-lg"
    >
      {{ t('vfx.tutorials.description', locale) }}
    </p>

    <ul
      class="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-8"
    >
      <li v-for="tutorial in vfxTutorials" :key="tutorial.id">
        <TutorialCard
          :tutorial="tutorial"
          :locale="locale"
          variant="overlay"
          @play="activeTutorialId = tutorial.id"
        />
      </li>
    </ul>

    <TutorialDetailDialog
      v-if="activeTutorial()"
      :tutorial="activeTutorial()!"
      :locale="locale"
      @close="activeTutorialId = null"
    />
  </section>
</template>
