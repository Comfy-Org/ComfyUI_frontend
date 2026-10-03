<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import {
  installers,
  platformIcons,
  useDownloadUrl
} from '../../../composables/useDownloadUrl'
import type { Locale } from '../../../i18n/translations'
import { translationsFor } from '../../../i18n/translations'
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
const { t } = translationsFor(locale)

const { installer, showFallback } = useDownloadUrl()

const buttons = computed(() => {
  if (installer.value) return [installer.value]
  if (showFallback.value) {
    return [installers.windows, installers.macArm]
  }
  return []
})

function hasInstallerMenu(index: number) {
  return showInstallerMenu && index === 0
}
</script>

<template>
  <div
    v-for="(btn, index) in buttons"
    :key="btn.url"
    :class="cn('inline-flex', hasInstallerMenu(index) && 'lg:min-w-60')"
  >
    <BrandButton
      :href="btn.url"
      target="_blank"
      size="lg"
      :class="
        cn(
          customClass,
          'flex-1',
          hasInstallerMenu(index) && 'rounded-r-none lg:min-w-0'
        )
      "
      :data-astro-prefetch="btn.platform === 'windows' ? 'false' : undefined"
      @click="captureDownloadClick(btn.platform)"
    >
      <span class="inline-flex items-center gap-2">
        <img
          :src="platformIcons[btn.platform]"
          alt=""
          class="inline-block size-5 shrink-0"
        />
        <span class="text-left">
          {{ t('download.hero.downloadLocal') }}
          <span
            class="block text-xs font-normal tracking-normal whitespace-normal"
          >
            {{ t(btn.label) }}
          </span>
        </span>
      </span>
    </BrandButton>
    <InstallerMenu v-if="hasInstallerMenu(index)" :locale />
  </div>
</template>
