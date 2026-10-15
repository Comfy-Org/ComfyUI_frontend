<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { BrandButtonVariants } from '@/components/common/brandButton.variants'
import type { Locale } from '@/i18n/translations'
import type { ModelLaunchHero } from './types'

import BrandButton from '@/components/common/BrandButton.vue'
import { translationsFor } from '@/i18n/translations'

const {
  primaryCta,
  primaryVariant,
  secondaryCta,
  fitContent = false,
  locale = 'en'
} = defineProps<{
  primaryCta?: ModelLaunchHero['primaryCta']
  primaryVariant: BrandButtonVariants['variant']
  secondaryCta?: ModelLaunchHero['secondaryCta']
  fitContent?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    v-if="primaryCta || secondaryCta"
    :class="
      cn(
        'mt-8 flex flex-col gap-4 sm:w-auto sm:flex-row',
        fitContent ? 'items-center' : 'w-full'
      )
    "
  >
    <BrandButton
      v-if="primaryCta"
      :href="primaryCta.href"
      :target="primaryCta.target"
      :variant="primaryVariant"
      size="lg"
      :class="
        cn('p-4 text-center lg:w-auto lg:min-w-52', !fitContent && 'w-full')
      "
    >
      {{ t(primaryCta.labelKey) }}
    </BrandButton>
    <BrandButton
      v-if="secondaryCta"
      :href="secondaryCta.href"
      :target="secondaryCta.target"
      variant="outline"
      size="lg"
      :class="
        cn('p-4 text-center lg:w-auto lg:min-w-52', !fitContent && 'w-full')
      "
    >
      {{ t(secondaryCta.labelKey) }}
    </BrandButton>
  </div>
</template>
