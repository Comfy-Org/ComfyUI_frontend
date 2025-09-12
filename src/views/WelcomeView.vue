<template>
  <BaseViewTemplate dark>
    <div class="flex items-center justify-center min-h-screen">
      <div class="grid grid-rows-2 gap-8">
        <!-- Top container: Logo -->
        <div class="flex items-end justify-center">
          <img
            src="/assets/images/comfy-brand-mark.svg"
            :alt="$t('g.logoAlt')"
            class="w-60"
          />
        </div>
        <!-- Bottom container: Title and button -->
        <div class="flex flex-col items-center justify-center gap-4">
          <h1
            class="text-3xl text-neutral-300"
            style="
              font-family: 'ABC ROM', sans-serif;
              font-weight: 500;
              font-style: italic;
            "
          >
            {{ $t('welcome.title') }}
          </h1>
          <!-- Get Started Button -->
          <Button
            :label="$t('welcome.getStarted')"
            class="px-8 py-2 mt-4 bg-brand-yellow hover:bg-brand-yellow/90 text-neutral-900 font-bold rounded-2xl transition-colors italic"
            style="font-family: 'ABC ROM Black Italic', sans-serif"
            @click="navigateTo('/install')"
          />
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const router = useRouter()
const navigateTo = async (path: string) => {
  await router.push(path)
}
</script>
