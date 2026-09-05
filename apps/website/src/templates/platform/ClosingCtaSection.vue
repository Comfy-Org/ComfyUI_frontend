<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'
import ClosingCtaColumnField from './ClosingCtaColumnField.vue'
import PlatformHeroBadge from './PlatformHeroBadge.vue'

const {
  locale = 'en',
  visual = 'shader',
  badgeOnly = false,
  headingAfterBadge,
  headingLead,
  primaryHref,
  subtitle
} = defineProps<{
  badgeOnly?: boolean
  headingAfterBadge?: string
  headingLead?: string
  locale?: Locale
  primaryHref?: string
  subtitle?: string
  visual?: 'columns' | 'shader'
}>()

const ctas = platformCtas(locale)
const primaryCta = primaryHref
  ? { label: ctas.getStarted.label, href: primaryHref }
  : ctas.getStarted
const isMounted = ref(false)
const TerminalAsciiShader = defineAsyncComponent(
  () => import('./TerminalAsciiShader.vue')
)

onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div class="relative isolate overflow-hidden bg-primary-comfy-ink">
    <div
      v-if="visual === 'shader'"
      class="mask-platform-terminal-feather pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <TerminalAsciiShader v-if="isMounted" />
    </div>
    <ClosingCtaColumnField v-else />
    <CtaCenter01
      compact
      class="relative z-10 min-h-96 justify-center"
      :heading="
        badgeOnly
          ? `${t('platform.hero.badge', locale)} ${t('nav.badgeBeta', locale)}`
          : headingLead
            ? `${headingLead} ${t('platform.hero.badge', locale)} ${t('nav.badgeBeta', locale)}`
            : headingAfterBadge
              ? `${t('platform.hero.badge', locale)} ${t('nav.badgeBeta', locale)} ${headingAfterBadge}`
              : t('platform.closing.heading', locale)
      "
      :subtitle
      :subtitle-class="badgeOnly ? 'mt-6' : undefined"
      :primary-cta="primaryCta"
      :secondary-cta="ctas.docs"
    >
      <template #heading>
        <template v-if="visual === 'columns'">
          <span v-if="!badgeOnly" class="block">
            {{ headingLead ?? t('platform.closing.headingLead', locale) }}
          </span>
          <PlatformHeroBadge
            :class="badgeOnly ? 'mx-auto md:my-2' : 'mx-auto -my-2 scale-75'"
            :center-text="badgeOnly"
            :large="badgeOnly"
            :locale
          />
        </template>
        <template v-else-if="badgeOnly">
          <PlatformHeroBadge
            class="mx-auto md:my-2"
            center-text
            large
            :locale
          />
        </template>
        <template v-else-if="headingLead">
          <span class="block">{{ headingLead }}</span>
          <PlatformHeroBadge class="mx-auto -my-2 w-fit scale-75" :locale />
        </template>
        <template v-else-if="headingAfterBadge">
          <PlatformHeroBadge class="mx-auto -my-2 w-fit scale-75" :locale />
          <span
            class="mt-5 block text-base/relaxed whitespace-pre-line lg:text-xl/relaxed"
          >
            {{ headingAfterBadge }}
          </span>
        </template>
        <template v-else>
          {{ t('platform.closing.heading', locale) }}
        </template>
      </template>
    </CtaCenter01>
  </div>
</template>
