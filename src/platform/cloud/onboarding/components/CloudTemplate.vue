<template>
  <div
    class="dark-theme flex h-svh w-screen items-center bg-primary-comfy-ink font-formula text-primary-comfy-canvas"
  >
    <div class="mx-auto flex size-full max-h-248 max-w-[100rem]">
      <div v-if="showHero" class="relative min-h-0 flex-1 overflow-hidden">
        <CloudHeroCarousel />
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-auto">
        <div
          class="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-8 lg:max-w-lg xl:py-10 2xl:max-w-xl"
        >
          <img
            src="/assets/images/comfy-logo-wordmark.svg"
            :alt="t('g.comfyOrgLogoAlt')"
            class="h-9 w-auto shrink-0 object-contain object-left lg:h-10 2xl:h-11"
          />

          <div class="my-auto w-full">
            <slot />
          </div>

          <CloudTermsNotice v-if="route.meta.showTermsNotice" />
          <CloudTemplateFooter v-if="!route.meta.showTermsNotice" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import CloudHeroCarousel from '@/platform/cloud/onboarding/components/CloudHeroCarousel.vue'
import CloudTemplateFooter from '@/platform/cloud/onboarding/components/CloudTemplateFooter.vue'
import CloudTermsNotice from '@/platform/cloud/onboarding/components/CloudTermsNotice.vue'

import '../assets/css/fonts.css'

const { t } = useI18n()
const route = useRoute()
const isWideViewport = useBreakpoints(breakpointsTailwind).greaterOrEqual('xl')
const showHero = computed(() => isWideViewport.value && !route.meta.hideHero)
</script>
