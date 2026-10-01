<script setup lang="ts">
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import RelightLights from './RelightLights.vue'
import RelightMood from './RelightMood.vue'
import RelightScene from './RelightScene.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup, tray, selected } = relight
</script>

<template>
  <RelightLights
    v-if="tray === 'lights'"
    :lights="setup.lights"
    :selected
    :locale
    @select="(id) => (selected = id)"
    @change="relight.updateLight"
    @remove="relight.removeLight"
    @add="relight.addLight"
    @close="tray = undefined"
  />
  <RelightMood
    v-if="tray === 'mood'"
    :mood="setup.mood"
    :locale
    @pick="relight.pickMood"
    @close="tray = undefined"
  />
  <RelightScene
    v-if="tray === 'scene'"
    :scene="setup.scene"
    :locale
    @change="relight.updateScene"
    @close="tray = undefined"
  />
</template>
