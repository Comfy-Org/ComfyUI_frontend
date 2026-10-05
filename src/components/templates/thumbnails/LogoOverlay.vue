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
      <Tooltip
        v-for="badge in logo.badges"
        :key="badge.provider"
        :open="openTooltip === `${logo.key}:${badge.provider}`"
        :delay-duration="0"
        disable-closing-trigger
        @update:open="setTooltipOpen(`${logo.key}:${badge.provider}`, $event)"
      >
        <TooltipTrigger as-child>
          <button
            type="button"
            :aria-label="badge.provider"
            data-testid="logo-badge"
            class="flex size-7 cursor-pointer items-center justify-center rounded-full border-none bg-black/30 p-0 backdrop-blur-[20px] focus-visible:ring-1 focus-visible:ring-white focus-visible:outline-none"
            @click.stop="setTooltipOpen(`${logo.key}:${badge.provider}`, true)"
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
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ badge.provider }}</TooltipContent>
      </Tooltip>
      <Tooltip
        v-if="logo.extraProviders.length"
        :open="openTooltip === `${logo.key}:extra`"
        :delay-duration="0"
        disable-closing-trigger
        @update:open="setTooltipOpen(`${logo.key}:extra`, $event)"
      >
        <TooltipTrigger as-child>
          <button
            type="button"
            :aria-label="logo.extraProviders.join(', ')"
            data-testid="logo-extra"
            class="flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-full border-none bg-black/30 px-1.5 text-xs font-medium text-white backdrop-blur-[20px] focus-visible:ring-1 focus-visible:ring-white focus-visible:outline-none"
            @click.stop="setTooltipOpen(`${logo.key}:extra`, true)"
          >
            +{{ logo.extraProviders.length }}
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ logo.extraProviders.join(', ') }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
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
const openTooltip = ref<string | null>(null)

function setTooltipOpen(key: string, open: boolean) {
  if (open) openTooltip.value = key
  else if (openTooltip.value === key) openTooltip.value = null
}

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
