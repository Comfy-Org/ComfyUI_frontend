<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import type { Locale } from '../../../i18n/translations'
import type { Platform } from '../../../composables/useDownloadUrl'
import { installers } from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import { captureDownloadClick } from '../../../scripts/posthog'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const icons: Record<Platform, string> = {
  windows: '/icons/os/windows.svg',
  mac: '/icons/os/apple.svg',
  linux: '/icons/os/linux.svg'
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-primary-comfy-canvas outline-none transition-colors select-none hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink focus:bg-primary-comfy-yellow focus:text-primary-comfy-ink'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="t('download.hero.installers.label', locale)"
      class="inline-flex min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-r-2xl border-l border-primary-comfy-ink/20 bg-primary-comfy-yellow px-3 text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow data-[state=open]:bg-primary-comfy-yellow/90"
    >
      <ChevronDown class="size-5" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-50 max-w-(--reka-dropdown-menu-content-available-width) min-w-64 rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuItem
          v-for="installer in installers"
          :key="installer.url"
          as-child
        >
          <a
            :href="installer.url"
            target="_blank"
            rel="noopener noreferrer"
            data-astro-prefetch="false"
            :class="itemClass"
            @click="captureDownloadClick(installer.platform)"
          >
            <i
              class="size-5 shrink-0 icon-mask"
              :style="{ maskImage: `url('${icons[installer.platform]}')` }"
              aria-hidden="true"
            />
            {{ t(installer.label, locale) }}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
