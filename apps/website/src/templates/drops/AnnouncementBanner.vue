<script setup lang="ts">
import { ArrowRight, X } from '@lucide/vue'
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import { resolveRel } from '../../utils/cta'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const signUpHref = `https://www.youtube.com/watch?v=${livestream.youtubeVideoId}`
const signUpRel = resolveRel({ target: '_blank' })

// User-initiated dismiss only — no time logic, so the banner renders in the
// static HTML and never flashes. Dismissal is per page view (not persisted).
const visible = ref(true)
</script>

<template>
  <div
    v-if="visible"
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
      <p class="text-primary-warm-white ppformula-text-center text-base/6">
        {{ t('launches.banner.text', locale) }}
      </p>
      <Button
        as="a"
        :href="signUpHref"
        target="_blank"
        :rel="signUpRel"
        variant="underlineLink"
        size="sm"
      >
        {{ t('launches.banner.cta', locale) }}
        <template #append>
          <ArrowRight class="size-4" />
        </template>
      </Button>
    </div>
    <div class="flex flex-1 justify-end">
      <IconButton
        type="button"
        :aria-label="t('nav.close', locale)"
        @click="visible = false"
      >
        <X class="size-5" aria-hidden="true" />
      </IconButton>
    </div>
  </div>
</template>
