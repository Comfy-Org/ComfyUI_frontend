<template>
  <div class="flex">
    <BaseViewTemplate dark class="flex-1">
      <template #header>
        <CloudLogo />
      </template>
      <slot />
      <template #footer>
        <CloudTemplateFooter />
      </template>
    </BaseViewTemplate>
    <div class="flex-1 relative bg-black overflow-hidden hidden lg:block">
      <!-- Video Background -->
      <video
        class="absolute inset-0 w-full h-full object-cover"
        autoplay
        muted
        loop
        playsinline
        :poster="videoPoster"
      >
        <source :src="videoSrc" type="video/mp4" />
      </video>

      <div class="absolute inset-0 w-full h-full bg-black/30"></div>

      <!-- Optional Overlay for better visual -->
      <div
        class="absolute inset-0 flex justify-center items-center text-white text-center"
      >
        <div>
          <h1 class="font-abcrom font-black italic uppercase hero-title">
            {{ t('cloudStart_title') }}
          </h1>
          <p class="m-2 text-xl text-center text-white">
            {{ t('cloudStart_desc') }}
          </p>
          <p class="m-0 text-xl text-center text-white">
            {{ t('cloudStart_explain') }}
          </p>
        </div>
      </div>
      <div class="absolute inset-0 flex flex-col justify-end px-14 pb-[64px]">
        <div class="flex items-center justify-between">
          <Button
            type="button"
            class="h-10 bg-black text-white font-bold"
            severity="secondary"
            @click="handleLearnAboutClick"
          >
            {{ t('cloudStart_learnAboutButton') }}
          </Button>
          <div class="flex items-center gap-3">
            <p class="text-md text-white">
              {{ t('cloudStart_wantToRun') }}
            </p>
            <Button
              type="button"
              class="h-10 bg-black text-white font-bold"
              severity="secondary"
              @click="handleDownloadClick"
            >
              {{ t('cloudStart_download') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { t } from '@/i18n'
import videoPoster from '@/platform/onboarding/cloud/assets/videos/thumbnail.png'
import videoSrc from '@/platform/onboarding/cloud/assets/videos/video.mp4'
import CloudLogo from '@/platform/onboarding/cloud/components/CloudLogo.vue'
import CloudTemplateFooter from '@/platform/onboarding/cloud/components/CloudTemplateFooter.vue'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const handleLearnAboutClick = () => {
  window.open('https://www.comfy.org', '_blank')
}

const handleDownloadClick = () => {
  window.open('https://www.comfy.org/download', '_blank')
}
</script>
<style scoped>
@import '@/platform/onboarding/cloud/assets/css/fonts.css';
</style>
