<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { Platform } from '../../../composables/useDownloadUrl'
import { installers, useDownloadUrl } from '../../../composables/useDownloadUrl'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { captureDownloadClick } from '../../../scripts/posthog'
import BrandButton from '../../common/BrandButton.vue'
import InstallerMenu from './InstallerMenu.vue'

const {
  locale = 'en',
  class: customClass = '',
  showInstallerMenu = false
} = defineProps<{
  locale?: Locale
  class?: HTMLAttributes['class']
  showInstallerMenu?: boolean
}>()

const { downloadUrl, platform, showFallback } = useDownloadUrl()

const label = computed(() => t('download.hero.downloadLocal', locale))

const ICONS: Record<Platform, string> = {
  windows: '/icons/os/windows.svg',
  mac: '/icons/os/apple.svg',
  linux: '/icons/os/linux.svg'
}

const buttons = computed(() => {
  if (platform.value) {
    return Object.values(installers).filter(
      (installer) => installer.url === downloadUrl.value
    )
  }
  if (showFallback.value) {
    return [installers.windows, installers.macArm]
  }
  return []
})
</script>

<template>
  <div
    v-for="btn in buttons"
    :key="btn.url"
    :class="
      cn(
        'inline-flex',
        showInstallerMenu && btn === buttons[0] && 'lg:min-w-60'
      )
    "
  >
    <BrandButton
      :href="btn.url"
      target="_blank"
      size="lg"
      :class="
        cn(
          customClass,
          'flex-1',
          showInstallerMenu && btn === buttons[0] && 'rounded-r-none lg:min-w-0'
        )
      "
      :aria-label="
        showFallback
          ? `${label} — ${btn.platform === 'mac' ? 'macOS' : 'Windows'}`
          : undefined
      "
      :data-astro-prefetch="btn.platform === 'windows' ? 'false' : undefined"
      @click="captureDownloadClick(btn.platform)"
    >
      <span class="inline-flex items-center gap-2">
        <img
          :src="ICONS[btn.platform]"
          alt=""
          class="inline-block size-5 shrink-0"
        />
        <span class="inline-block">{{ label }}</span>
      </span>
    </BrandButton>
    <InstallerMenu v-if="showInstallerMenu && btn === buttons[0]" :locale />
  </div>
</template>
