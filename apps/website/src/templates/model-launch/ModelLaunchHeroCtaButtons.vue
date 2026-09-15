<script setup lang="ts">
import type { BrandButtonVariants } from '../../components/common/brandButton.variants'
import BrandButton from '../../components/common/BrandButton.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { ModelLaunchHero } from './types'

const {
  primaryCta,
  primaryVariant,
  secondaryCta,
  locale = 'en'
} = defineProps<{
  primaryCta?: ModelLaunchHero['primaryCta']
  primaryVariant: BrandButtonVariants['variant']
  secondaryCta?: ModelLaunchHero['secondaryCta']
  locale?: Locale
}>()
</script>

<template>
  <div
    v-if="primaryCta || secondaryCta"
    class="mt-8 flex w-full flex-col gap-4 sm:w-auto sm:flex-row"
  >
    <BrandButton
      v-if="primaryCta"
      :href="primaryCta.href"
      :target="primaryCta.target"
      :variant="primaryVariant"
      size="lg"
      class="w-full p-4 text-center lg:w-auto lg:min-w-52"
    >
      {{ t(primaryCta.labelKey, locale) }}
    </BrandButton>
    <BrandButton
      v-if="secondaryCta"
      :href="secondaryCta.href"
      :target="secondaryCta.target"
      variant="outline"
      size="lg"
      class="w-full p-4 text-center lg:w-auto lg:min-w-52"
    >
      {{ t(secondaryCta.labelKey, locale) }}
    </BrandButton>
  </div>
</template>
