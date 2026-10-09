<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import RevealLine from './RevealLine.vue'

const {
  userName,
  title,
  reveal = false
} = defineProps<{
  userName?: string
  title: string
  reveal?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex max-w-sm flex-col items-center text-base/snug font-semibold tracking-tight text-base-foreground @min-[570px]:text-2xl/snug"
  >
    <p class="my-0">
      <RevealLine :index="0" :enabled="reveal">
        {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
      </RevealLine>
    </p>
    <p class="my-0">
      <RevealLine :index="1" :enabled="reveal">{{ title }}</RevealLine>
    </p>
  </div>
</template>
