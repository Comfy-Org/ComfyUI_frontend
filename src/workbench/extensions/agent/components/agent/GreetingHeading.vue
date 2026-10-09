<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SpokenText from './SpokenText.vue'

const { userName, title, timing } = defineProps<{
  userName?: string
  title: string
  timing?: { intro: number; title: number }
}>()

const { t } = useI18n()

const intro = computed(() =>
  t('agent.greeting', { name: userName ?? t('agent.friend') })
)
</script>

<template>
  <div
    class="flex max-w-sm flex-col items-center text-base/snug font-semibold tracking-tight text-base-foreground @min-[570px]:text-2xl/snug"
  >
    <p class="my-0">
      <SpokenText v-if="timing" :text="intro" :start-ms="timing.intro" />
      <template v-else>{{ intro }}</template>
    </p>
    <p class="my-0">
      <SpokenText v-if="timing" :text="title" :start-ms="timing.title" />
      <template v-else>{{ title }}</template>
    </p>
  </div>
</template>
