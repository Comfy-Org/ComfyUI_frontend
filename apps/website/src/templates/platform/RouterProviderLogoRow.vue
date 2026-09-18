<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { providers, animated = true } = defineProps<{
  providers: readonly { name: string; src: string; logoClass?: string }[]
  animated?: boolean
}>()

const mobileRow1Providers = providers.slice(0, Math.ceil(providers.length / 2))
const mobileRow2Providers = providers.slice(Math.ceil(providers.length / 2))
</script>

<template>
  <section class="overflow-hidden py-8 md:py-12">
    <ul
      v-if="!animated"
      class="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 md:flex-nowrap md:gap-x-24"
      role="list"
    >
      <li
        v-for="provider in providers"
        :key="provider.name"
        class="flex h-20 shrink-0 items-center justify-center"
      >
        <img
          :src="provider.src"
          :alt="provider.name"
          :class="
            cn('max-h-full max-w-full object-contain', provider.logoClass)
          "
          style="
            filter: brightness(0) saturate(100%) invert(27%) sepia(16%)
              saturate(2075%) hue-rotate(225deg) brightness(93%) contrast(88%);
          "
        />
      </li>
    </ul>

    <div v-else class="hidden w-max gap-2 md:flex">
      <div
        v-for="copy in 2"
        :key="copy"
        class="flex shrink-0 animate-marquee items-center gap-2"
        style="--marquee-gap: 0.5rem"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <div
          v-for="provider in providers"
          :key="provider.name"
          class="flex h-20 w-50 shrink-0 items-center justify-center"
        >
          <img
            :src="provider.src"
            :alt="provider.name"
            :aria-hidden="copy === 2 ? 'true' : undefined"
            class="max-h-full max-w-full object-contain"
            style="
              filter: brightness(0) saturate(100%) invert(27%) sepia(16%)
                saturate(2075%) hue-rotate(225deg) brightness(93%) contrast(88%);
            "
          />
        </div>
      </div>
    </div>

    <div v-if="animated" class="flex flex-col gap-6 md:hidden">
      <div class="flex w-max gap-8">
        <div
          v-for="copy in 2"
          :key="copy"
          class="flex shrink-0 animate-marquee items-center gap-8"
          style="--marquee-gap: 2rem"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="provider in mobileRow1Providers"
            :key="provider.name"
            class="flex h-10 w-40 shrink-0 items-center justify-center"
          >
            <img
              :src="provider.src"
              :alt="provider.name"
              :aria-hidden="copy === 2 ? 'true' : undefined"
              class="max-h-full max-w-full object-contain"
              style="
                filter: brightness(0) saturate(100%) invert(27%) sepia(16%)
                  saturate(2075%) hue-rotate(225deg) brightness(93%)
                  contrast(88%);
              "
            />
          </div>
        </div>
      </div>
      <div class="flex w-max gap-8">
        <div
          v-for="copy in 2"
          :key="copy"
          class="flex shrink-0 animate-marquee-reverse items-center gap-8"
          style="--marquee-gap: 2rem"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="provider in mobileRow2Providers"
            :key="provider.name"
            class="flex h-10 w-40 shrink-0 items-center justify-center"
          >
            <img
              :src="provider.src"
              :alt="provider.name"
              :aria-hidden="copy === 2 ? 'true' : undefined"
              class="max-h-full max-w-full object-contain"
              style="
                filter: brightness(0) saturate(100%) invert(27%) sepia(16%)
                  saturate(2075%) hue-rotate(225deg) brightness(93%)
                  contrast(88%);
              "
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
