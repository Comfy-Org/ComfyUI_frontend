<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const investors = [
  { name: 'CRAFT', icon: '/icons/investors/craft.svg' },
  { name: 'PACE CAPITAL', icon: '/icons/investors/pace-capital.svg' },
  { name: 'chemistry_', icon: '/icons/investors/chemistry.svg' },
  { name: 'TRUARROW PARTNERS', icon: '/icons/investors/truarrow-partners.svg' },
  { name: 'SAPPHIRE VENTURES', icon: '/icons/investors/sapphire-ventures.svg' },
  { name: 'ESSENCE', icon: '/icons/investors/essence.svg' }
]
</script>

<template>
  <section class="px-6 py-24 lg:px-20 lg:py-32">
    <div class="mx-auto text-center">
      <span
        class="text-primary-comfy-yellow text-xs font-semibold tracking-widest uppercase"
      >
        {{ t('about.story.label', locale) }}
      </span>
      <h2
        class="text-primary-comfy-canvas mt-6 text-3xl font-light lg:text-5xl"
      >
        {{ t('about.story.headingBefore', locale)
        }}<span class="text-primary-comfy-yellow">{{
          t('about.story.headingHighlight', locale)
        }}</span
        >{{ t('about.story.headingAfter', locale) }}
      </h2>
      <p class="text-primary-warm-white mt-8 text-base/relaxed lg:text-lg">
        {{ t('about.story.body', locale) }}
      </p>
    </div>

    <!-- Investor card -->
    <div
      class="mx-auto mt-16 max-w-5xl rounded-4xl border border-white/10 bg-black/30 p-8 lg:p-12"
    >
      <div class="inline-flex items-center">
        <!-- OUR badge (shorter) -->
        <div class="relative z-10 flex h-9 items-center">
          <img src="/icons/node-left.svg" alt="" class="h-full w-auto" />
          <span
            class="bg-primary-comfy-yellow text-primary-comfy-ink flex h-full items-center px-2 text-sm font-bold tracking-wider"
          >
            OUR
          </span>
        </div>
        <!-- Union connector (overlaps both badges to eliminate seams) -->
        <img
          src="/icons/node-union-2size-reverse.svg"
          alt=""
          class="relative z-20 -mx-px h-12 w-auto"
        />
        <!-- INVESTORS badge (taller) -->
        <div class="relative z-10 flex h-12 items-center">
          <span
            class="bg-primary-comfy-yellow text-primary-comfy-ink flex h-full items-center px-3 text-lg font-bold tracking-wider"
          >
            INVESTORS
          </span>
          <img src="/icons/node-right.svg" alt="" class="h-full w-auto" />
        </div>
      </div>
      <p
        class="text-primary-warm-white mt-6 max-w-3xl text-sm/relaxed lg:text-base"
      >
        {{ t('about.story.investorsBody', locale) }}
      </p>
      <div class="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
        <div
          v-for="investor in investors"
          :key="investor.name"
          class="flex h-16 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4"
        >
          <img
            :src="investor.icon"
            :alt="investor.name"
            class="max-h-8 w-auto"
          />
        </div>
      </div>
    </div>

    <!-- Quote card -->
    <div
      class="bg-primary-comfy-yellow mx-auto mt-12 max-w-5xl rounded-4xl p-10 lg:p-16"
    >
      <p class="text-primary-comfy-ink text-xl/relaxed font-medium lg:text-3xl">
        {{ t('about.quote.text', locale) }}
      </p>
      <p
        class="text-primary-comfy-ink/70 mt-8 text-sm font-semibold lg:text-base"
      >
        {{ t('about.quote.attribution', locale) }}
      </p>
    </div>
  </section>
</template>
