<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { routerT } from './routerCopy'
import CodeTabs from './CodeTabs.vue'
import type { RouterProvider } from './codeSamples'
import { ROUTER_PROVIDERS, routerCodeTabs } from './codeSamples'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const providerLogos: Record<
  RouterProvider,
  { name: string; logo: string; logoClass: string }
> = {
  comfy: {
    name: 'Comfy',
    logo: '/icons/router-providers/comfy.svg',
    logoClass: 'h-3.5'
  },
  fal: {
    name: 'fal',
    logo: '/icons/router-providers/fal.svg',
    logoClass: 'h-3.5'
  },
  runware: {
    name: 'Runware',
    logo: '/icons/router-providers/runware.svg',
    logoClass: 'h-3'
  },
  wavespeed: {
    name: 'WaveSpeed',
    logo: '/icons/router-providers/wavespeed.svg',
    logoClass: 'h-3'
  },
  higgsfield: {
    name: 'Higgsfield',
    logo: '/icons/router-providers/higgsfield.svg',
    logoClass: 'h-3.5'
  }
}

const providerOptions = ROUTER_PROVIDERS.map((id) => ({
  id,
  ...providerLogos[id]
}))

const selectedProvider = ref<RouterProvider>(providerOptions[0].id)
</script>

<template>
  <section class="mx-auto max-w-4xl px-6 py-10 lg:py-14">
    <h2
      class="text-center text-2xl/tight font-light text-balance text-primary-comfy-canvas lg:text-3xl/tight"
    >
      {{ routerT('platform.router.code.heading', locale) }}
    </h2>
    <div class="mt-8">
      <CodeTabs
        :tabs="routerCodeTabs"
        :label="routerT('platform.router.code.heading', locale)"
        :selected-index="ROUTER_PROVIDERS.indexOf(selectedProvider)"
        picker="dropdown"
        content-class="bg-[#2a2230]"
        :copy-label="t('ui.copy', locale)"
        :copied-label="t('ui.copied', locale)"
      >
        <template #controls>
          <RadioGroupRoot
            v-model="selectedProvider"
            orientation="horizontal"
            :aria-label="routerT('platform.router.code.providerLabel', locale)"
            class="flex w-full max-w-full items-center rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 sm:w-auto"
          >
            <RadioGroupItem
              v-for="option in providerOptions"
              :key="option.id"
              :value="option.id"
              :aria-label="option.name"
              class="flex flex-1 cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 opacity-40 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none data-[state=checked]:bg-secondary-mauve data-[state=checked]:opacity-100 sm:flex-none sm:px-5"
            >
              <img
                :src="option.logo"
                alt=""
                :class="cn('w-auto brightness-0 invert', option.logoClass)"
              />
            </RadioGroupItem>
          </RadioGroupRoot>
        </template>
      </CodeTabs>
    </div>
    <p class="mt-6 text-center text-sm text-primary-comfy-canvas/70">
      {{ routerT('platform.router.code.supporting', locale) }}
    </p>
  </section>
</template>
