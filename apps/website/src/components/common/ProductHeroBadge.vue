<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  logoSrc = '/icons/logo.svg',
  logoAlt = 'Comfy',
  logoClass,
  compact = false,
  text = 'DESKTOP',
  showLogo = true,
  showConnector = true
} = defineProps<{
  compact?: boolean
  logoClass?: string
  logoSrc?: string
  logoAlt?: string
  text?: string
  showLogo?: boolean
  showConnector?: boolean
}>()

// Compact sizes the lockup once on the wrapper and lets every piece fill it,
// the way PlatformHeroBadge does. The caps and connector then take their width
// from their own aspect ratio, so there is one height to change rather than a
// per-piece width and height at each breakpoint.
const PIECE = 'h-full w-auto'
</script>

<template>
  <div
    :class="
      cn(
        'font-formula-narrow flex shrink-0 items-stretch font-semibold',
        compact && 'h-[clamp(22px,4vw,46px)]'
      )
    "
  >
    <img
      v-if="showLogo"
      src="/icons/node-left.svg"
      alt=""
      :width="compact ? 21 : 43"
      :height="compact ? 46 : 95"
      :class="
        cn(
          '-mx-px my-auto self-center',
          compact ? PIECE : 'h-12 w-5.5 lg:my-0 lg:size-auto lg:self-stretch'
        )
      "
      aria-hidden="true"
    />

    <img
      v-else
      src="/icons/node-left.svg"
      alt=""
      :width="compact ? 21 : 28"
      :height="compact ? 46 : 62"
      :class="
        cn(
          '-mx-px my-auto self-center',
          compact ? PIECE : 'h-7.25 w-[13px] lg:h-15.5 lg:w-7'
        )
      "
      aria-hidden="true"
    />

    <span
      v-if="showLogo"
      :class="
        cn(
          'bg-primary-comfy-yellow text-primary-comfy-ink my-auto flex items-center justify-center',
          compact ? 'h-full px-3 lg:px-4.5' : 'h-12 lg:my-0 lg:h-auto lg:p-8',
          // Without the connector the two slabs butt together, so the facing
          // edges lose their padding and read as one block.
          compact && !showConnector && 'pr-1 lg:pr-1'
        )
      "
    >
      <img
        :src="logoSrc"
        :alt="logoAlt"
        :width="compact ? 87 : 173"
        :height="compact ? 24 : 48"
        :class="
          cn(
            'inline-block w-auto brightness-0',
            compact ? 'h-3.5 lg:h-6' : 'h-6 lg:h-10',
            logoClass
          )
        "
      />
    </span>

    <img
      v-if="showLogo && showConnector"
      data-testid="product-hero-badge-connector"
      src="/icons/node-union-2size.svg"
      alt=""
      :width="compact ? 30 : 62"
      :height="compact ? 46 : 94"
      :class="
        cn(
          '-mx-px my-auto self-center',
          compact ? PIECE : 'h-12 w-8 lg:my-0 lg:size-auto lg:self-stretch'
        )
      "
      aria-hidden="true"
    />

    <span
      :class="
        cn(
          'bg-primary-comfy-yellow text-primary-comfy-ink my-auto flex items-center justify-center',
          compact ? 'h-full lg:px-4.5' : 'h-7.25 lg:h-15.5 lg:px-6',
          !showLogo && (compact ? 'px-3' : 'px-4'),
          showLogo && !showConnector && compact && 'pr-3 pl-1 lg:pr-4.5 lg:pl-1'
        )
      "
    >
      <span
        :class="
          cn(
            'inline-block translate-y-0.5 leading-none font-bold whitespace-nowrap',
            compact ? 'text-lg lg:text-2xl' : 'text-2xl lg:text-3xl'
          )
        "
      >
        {{ text }}
      </span>
    </span>

    <img
      src="/icons/node-right.svg"
      alt=""
      :width="compact ? 21 : 28"
      :height="compact ? 46 : 62"
      :class="
        cn(
          'my-auto -mr-px -ml-0.5 self-center',
          compact ? PIECE : 'h-7.25 w-[13px] lg:h-15.5 lg:w-7'
        )
      "
      aria-hidden="true"
    />
  </div>
</template>
