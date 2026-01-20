<template>
  <BaseViewTemplate dark>
    <div class="flex min-h-screen items-center justify-center">
      <div class="grid gap-8">
        <!-- Top container: Logo -->
        <div class="flex items-end justify-center">
          <img
            src="/assets/images/comfy-brand-mark.svg"
            :alt="$t('g.logoAlt')"
            class="w-60"
          >
        </div>
        <!-- Bottom container: Title and button -->
        <div class="flex flex-col items-center justify-center gap-4">
          <Button
            :label="$t('welcome.getStarted')"
            class="mt-4 rounded-lg border-0 bg-brand-yellow px-8 transition-colors hover:bg-brand-yellow/90"
            :pt="{
              label: { class: 'font-inter text-neutral-900 font-black' }
            }"
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
