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
</script>

<template>
  <Transition name="banner-collapse" @after-leave="persistHidden">
    <div v-if="isVisible" class="banner-collapse grid">
      <div class="min-h-0 overflow-hidden">
        <div
          data-slot="announcement-banner"
          class="after:bg-transparency-white-t4 relative flex items-center gap-x-6 px-6 py-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px sm:px-3.5 sm:before:flex-1"
          style="
            background: linear-gradient(
              90deg,
              var(--color-primary-comfy-plum) 0%,
              var(--color-secondary-deep-plum) 53.85%,
              var(--color-secondary-mauve) 100%
            );
          "
        >
          <div class="flex flex-wrap items-center gap-x-8 gap-y-2">
            <p class="text-primary-warm-white text-sm md:text-base/6">
              {{ data.title }}
              <span v-if="data.description" class="text-primary-warm-white/80">
                {{ data.description }}
              </span>
            </p>
            <Button
              v-if="data.link"
              as="a"
              :href="data.link.href"
              :target="data.link.target"
              :rel="data.link.rel"
              :variant="data.link.buttonVariant ?? 'underlineLink'"
              size="sm"
            >
              {{ data.link.title }}
              <template #append>
                <ArrowRight class="size-4" />
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
