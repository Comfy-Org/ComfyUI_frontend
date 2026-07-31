<template>
  <div
    v-for="logo in validLogos"
    :key="logo.key"
    :class="cn('absolute z-10', logo.position ?? defaultPosition)"
  >
    <div
      v-show="!hasAllFailed(logo.badges)"
      data-testid="logo-pill"
      class="flex items-center gap-1"
    >
      <AccessibleTooltip
        v-for="badge in logo.badges"
        :key="badge.provider"
        :label="badge.provider"
        test-id="logo-badge"
        ring-class="focus-visible:ring-white"
        trigger-class="flex size-7 items-center justify-center rounded-full bg-black/30 backdrop-blur-[20px]"
      >
        <i
          v-if="badge.iconClass"
          data-testid="logo-icon"
          :class="cn('size-3.5 text-white', badge.iconClass)"
          aria-hidden="true"
        />
        <img
          v-else
          data-testid="logo-img"
          :src="badge.logoUrl"
          alt=""
          class="size-4 rounded-full object-cover"
          draggable="false"
          @error="onImageError(badge.provider)"
        />
      </AccessibleTooltip>
      <AccessibleTooltip
        v-if="logo.extraProviders.length"
        :label="logo.extraProviders"
        test-id="logo-extra"
        ring-class="focus-visible:ring-white"
        trigger-class="flex h-7 min-w-7 items-center justify-center rounded-full bg-black/30 px-1.5 text-xs font-medium text-white backdrop-blur-[20px]"
      >
        +{{ logo.extraProviders.length }}
      </AccessibleTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import type { LogoInfo } from '@/platform/workflow/templates/types/template'
import type { ProviderBadge } from '@/platform/workflow/templates/utils/templateDisplay'
import { getProviderBadges } from '@/platform/workflow/templates/utils/templateDisplay'
import { cn } from '@comfyorg/tailwind-utils'

const {
  logos,
  getLogoUrl,
  defaultPosition = 'top-2 left-2'
} = defineProps<{
  logos: LogoInfo[]
  getLogoUrl: (provider: string) => string
  defaultPosition?: string
}>()

const failedLogos = ref(new Set<string>())

function onImageError(provider: string) {
  failedLogos.value = new Set([...failedLogos.value, provider])
}

function hasAllFailed(badges: ProviderBadge[]): boolean {
  return (
    badges.length > 0 &&
    badges.every(
      (badge) => !badge.iconClass && failedLogos.value.has(badge.provider)
    )
  )
}

interface ValidatedLogo {
  key: string
  badges: ProviderBadge[]
  extraProviders: string[]
  position: string | undefined
}

const validLogos = computed<ValidatedLogo[]>(() =>
  logos.flatMap((logo) => {
    const badges = getProviderBadges(logo, getLogoUrl)
    if (!badges) return []

    const providerKey = badges.visible.map((b) => b.provider).join('-')
    return {
      key: `${providerKey}-${logo.position ?? ''}`,
      badges: badges.visible,
      extraProviders: badges.extraProviders,
      position: logo.position
    }
  })
)
</script>
