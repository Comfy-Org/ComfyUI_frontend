<template>
  <div class="flex items-center gap-2 bg-comfy-menu-secondary px-3">
    <div
      class="rounded-full bg-white px-1.5 py-0.5 text-xxxs font-semibold text-black"
    >
      {{ betaString }}
    </div>
    <div class="font-inter text-sm font-extrabold text-slate-100">
      {{ cloudText }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const betaString = t('g.beta')
const cloudText = 'Comfy Cloud'
</script>
