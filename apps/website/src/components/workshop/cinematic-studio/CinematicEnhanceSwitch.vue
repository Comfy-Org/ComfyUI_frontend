<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { locale = 'en', class: className } = defineProps<{
  locale?: Locale
  class?: string
}>()

const enhance = defineModel<boolean>({ required: true })
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <label
          :class="
            cn(
              'flex w-fit cursor-pointer items-center gap-2.5 text-xs text-primary-warm-white',
              className
            )
          "
        >
          <input
            v-model="enhance"
            type="checkbox"
            role="switch"
            :aria-description="tc('cinematic.scene.enhanceHint', locale)"
            class="peer sr-only"
          />
          <span
            class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
            aria-hidden="true"
          />
          {{ tc('cinematic.scene.enhance', locale) }}
        </label>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="top"
          :side-offset="8"
          class="z-60 max-w-64 rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light px-3 py-2 text-xs/relaxed text-primary-comfy-canvas shadow-lg"
        >
          {{ tc('cinematic.scene.enhanceHint', locale) }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
