<script setup lang="ts">
import { ArrowRight, X } from '@lucide/vue'

import type { BannerData } from '../../config/banner'
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import { useBannerDismissal } from '../../composables/useBannerDismissal'

const {
  data,
  version,
  locale = 'en'
} = defineProps<{
  data: BannerData
  version: string
  locale?: Locale
}>()

const { isVisible, close, persistHidden } = useBannerDismissal(version)

// Engaging with the CTA dismisses the banner too.
function onCtaClick(): void {
  close()
  persistHidden()
}
</script>

<template>
  <Transition name="banner-collapse" @after-leave="persistHidden">
    <div v-if="isVisible" class="banner-collapse grid">
      <div class="min-h-0 overflow-hidden">
        <div
          data-slot="announcement-banner"
          class="bg-primary-comfy-ink-light relative flex items-center gap-x-4 px-4 py-2.5 sm:before:flex-1"
        >
          <!-- Acid-yellow hairline separating the bar from the navbar. -->
          <div
            class="bg-primary-comfy-yellow/40 pointer-events-none absolute inset-x-0 bottom-0 h-px"
            aria-hidden="true"
          />

          <div
            class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
          >
            <p
              class="ppformula-text-center text-primary-warm-white text-sm md:text-[15px]/6"
            >
              {{ data.title }}
              <span v-if="data.description" class="text-primary-warm-white/70">
                {{ data.description }}
              </span>
            </p>
            <Button
              v-if="data.link"
              as="a"
              :href="data.link.href"
              :target="data.link.target"
              :rel="data.link.rel"
              :variant="data.link.buttonVariant ?? 'default'"
              size="sm"
              class="group/cta shrink-0"
              @click="onCtaClick"
            >
              {{ data.link.title }}
              <template #append>
                <ArrowRight
                  class="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5"
                />
              </template>
            </Button>
          </div>

          <div class="flex flex-1 justify-end">
            <IconButton
              type="button"
              :aria-label="t('nav.close', locale)"
              @click="close"
            >
              <X class="size-5" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Collapse the banner's height (grid 1fr → 0fr) so page content below slides
   up smoothly, with a fade. Enter is defined for symmetry; in practice only the
   leave (dismiss) runs, since the banner renders present in the static HTML. */
.banner-collapse {
  grid-template-rows: 1fr;
}

.banner-collapse-enter-active,
.banner-collapse-leave-active {
  transition:
    grid-template-rows 300ms ease,
    opacity 250ms ease;
}

.banner-collapse-enter-from,
.banner-collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .banner-collapse-enter-active,
  .banner-collapse-leave-active {
    transition: none;
  }
}
</style>
