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
</script>

<template>
  <div
    class="font-formula-narrow flex shrink-0 items-stretch font-semibold"
    :style="compact ? { height: 'clamp(22px, 4vw, 46px)' } : undefined"
  >
    <img
      v-if="showLogo"
      src="/icons/node-left.svg"
      alt=""
      :width="compact ? 21 : 43"
      :height="compact ? 46 : 95"
      :style="compact ? { width: 'auto', height: '100%' } : undefined"
      :class="
        cn(
          '-mx-px my-auto self-center',
          compact
            ? 'h-5.5 w-2.5 lg:my-0 lg:h-11.5 lg:w-[21px] lg:self-stretch'
            : 'h-12 w-5.5 lg:my-0 lg:size-auto lg:self-stretch'
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
      :style="compact ? { width: 'auto', height: '100%' } : undefined"
      :class="
        cn(
          '-mx-px my-auto self-center',
          compact
            ? 'h-5.5 w-2.5 lg:h-11.5 lg:w-[21px]'
            : 'h-7.25 w-[13px] lg:h-15.5 lg:w-7'
        )
      "
      aria-hidden="true"
    />

    <span
      v-if="showLogo"
      :style="compact ? { height: '100%' } : undefined"
      :class="
        cn(
          'bg-primary-comfy-yellow my-auto flex items-center justify-center text-primary-comfy-ink',
          compact
            ? showConnector
              ? 'h-5.5 px-3 lg:my-0 lg:h-11.5 lg:px-4.5'
              : 'h-5.5 pr-1 pl-3 lg:my-0 lg:h-11.5 lg:pr-1 lg:pl-4.5'
            : 'h-12 lg:my-0 lg:h-auto lg:p-8'
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
      src="/icons/node-union-2size.svg"
      alt=""
      :width="compact ? 30 : 62"
      :height="compact ? 46 : 94"
      :style="compact ? { width: 'auto', height: '100%' } : undefined"
      :class="
        cn(
          '-mx-px my-auto self-center',
          compact
            ? 'h-5.5 w-[15px] lg:my-0 lg:h-11.5 lg:w-[30px] lg:self-stretch'
            : 'h-12 w-8 lg:my-0 lg:size-auto lg:self-stretch'
        )
      "
      aria-hidden="true"
    />

    <span
      :style="compact ? { height: '100%' } : undefined"
      :class="
        cn(
          'bg-primary-comfy-yellow my-auto flex items-center justify-center text-primary-comfy-ink',
          compact ? 'h-5.5 lg:h-11.5 lg:px-4.5' : 'h-7.25 lg:h-15.5 lg:px-6',
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
      :style="compact ? { width: 'auto', height: '100%' } : undefined"
      :class="
        cn(
          'my-auto -mr-px -ml-0.5 self-center',
          compact
            ? 'h-5.5 w-2.5 lg:h-11.5 lg:w-[21px]'
            : 'h-7.25 w-[13px] lg:h-15.5 lg:w-7'
        )
      "
      aria-hidden="true"
    />
  </div>
</template>
