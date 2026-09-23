<script setup lang="ts">
import { Check } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import logoSvg from '../../../assets/brand/logo.svg?raw'
import logomarkSvg from '../../../assets/brand/logomark.svg?raw'
import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const svgAssets = [
  { id: 'logo', label: t('nav.copyLogoSvg', locale), svg: logoSvg },
  { id: 'logomark', label: t('nav.copyLogomarkSvg', locale), svg: logomarkSvg }
]

const { copy, copied, text: copiedSvg } = useClipboard({ copiedDuring: 1500 })

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-primary-comfy-canvas outline-none transition-colors select-none hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink focus:bg-primary-comfy-yellow focus:text-primary-comfy-ink'
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-50 min-w-56 rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <ContextMenuItem
          v-for="asset in svgAssets"
          :key="asset.id"
          :class="itemClass"
          @select.prevent="void copy(asset.svg)"
        >
          <span role="status" aria-live="polite">
            <template v-if="copied && copiedSvg === asset.svg">
              <Check class="size-4" aria-hidden="true" />
              {{ t('nav.copied', locale) }}
            </template>
            <template v-else>{{ asset.label }}</template>
          </span>
        </ContextMenuItem>
        <ContextMenuItem as-child>
          <a :href="routes.brand" :class="itemClass">
            {{ t('nav.brandAssets', locale) }}
          </a>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
