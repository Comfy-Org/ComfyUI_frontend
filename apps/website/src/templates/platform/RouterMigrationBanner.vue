<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard } from '@vueuse/core'

import { ROUTER_MIGRATION_PROMPT } from '../../config/router-migration-prompt'
import type { Locale } from '../../i18n/translations'
import { routerT } from './routerCopy'
import BrandButton from '../../components/common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { copy, copied } = useClipboard({ copiedDuring: 2000 })
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 lg:px-16">
    <div
      class="flex flex-col gap-4 rounded-3xl bg-primary-comfy-ink-light px-8 py-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-lg font-bold text-primary-comfy-canvas">
          {{ routerT('platform.router.migrate.title', locale) }}
        </p>
        <p class="mt-1 text-sm text-pretty text-primary-comfy-canvas">
          {{ routerT('platform.router.migrate.subtitle', locale) }}
        </p>
      </div>
      <BrandButton
        variant="outline"
        size="xs"
        class="shrink-0 self-start sm:self-auto"
        @click="void copy(ROUTER_MIGRATION_PROMPT)"
      >
        <span class="inline-flex items-center gap-2">
          <span class="grid">
            <span
              :class="cn('[grid-area:1/1]', copied && 'invisible')"
              aria-hidden="true"
            >
              {{ routerT('platform.router.migrate.copyPrompt', locale) }}
            </span>
            <span
              :class="cn('[grid-area:1/1]', !copied && 'invisible')"
              aria-hidden="true"
            >
              {{ routerT('platform.router.migrate.copied', locale) }}
            </span>
            <span class="sr-only">
              {{
                routerT(
                  copied
                    ? 'platform.router.migrate.copied'
                    : 'platform.router.migrate.copyPrompt',
                  locale
                )
              }}
            </span>
          </span>
          <component :is="copied ? Check : Copy" class="size-4" />
        </span>
      </BrandButton>
    </div>
  </section>
</template>
