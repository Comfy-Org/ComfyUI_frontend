<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'
import Button from '../ui/button/Button.vue'

const {
  locale,
  headingKey,
  primaryLabelKey,
  primaryHref,
  primaryTarget,
  secondaryLabelKey,
  secondaryHref,
  secondaryTarget
} = defineProps<{
  locale: Locale
  headingKey: TranslationKey
  primaryLabelKey: TranslationKey
  primaryHref?: string
  primaryTarget?: string
  secondaryLabelKey?: TranslationKey
  secondaryHref?: string
  secondaryTarget?: string
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-20 lg:py-32">
    <div class="flex flex-col items-center text-center">
      <h2
        class="max-w-5xl text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t(headingKey, locale) }}
      </h2>
      <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button
          :href="primaryHref"
          :target="primaryTarget"
          :rel="resolveRel({ target: primaryTarget })"
          variant="default"
        >
          {{ t(primaryLabelKey, locale) }}
        </Button>
        <Button
          v-if="secondaryLabelKey"
          :href="secondaryHref"
          :target="secondaryTarget"
          :rel="resolveRel({ target: secondaryTarget })"
          variant="outline"
        >
          {{ t(secondaryLabelKey, locale) }}
        </Button>
      </div>
    </div>
  </section>
</template>
