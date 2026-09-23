<script setup lang="ts">
import { Check } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

interface MenuOption {
  readonly id: string
  readonly label: string
  readonly meta?: string
  readonly logo?: string
}

const {
  options,
  heading,
  triggerClass,
  side = 'top'
} = defineProps<{
  options: readonly MenuOption[]
  heading: string
  triggerClass?: string
  side?: 'top' | 'bottom'
}>()

const value = defineModel<string>({ required: true })
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="heading"
      :class="
        cn(
          'flex items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 data-[state=open]:bg-transparency-white-t8',
          triggerClass
        )
      "
    >
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side
        align="start"
        :side-offset="8"
        :collision-padding="8"
        class="z-50 min-w-60 rounded-2xl border border-transparency-white-t8 bg-site-dropdown p-1.5 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuLabel
          class="px-2.5 pt-1.5 pb-1 text-xs text-primary-warm-gray"
        >
          {{ heading }}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="value">
          <DropdownMenuRadioItem
            v-for="option in options"
            :key="option.id"
            :value="option.id"
            class="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-primary-warm-white outline-none data-highlighted:bg-transparency-white-t8 data-[state=checked]:bg-transparency-white-t4"
          >
            <img v-if="option.logo" :src="option.logo" alt="" class="size-4" />
            <span class="flex-1">{{ option.label }}</span>
            <span v-if="option.meta" class="text-xs text-primary-warm-gray">
              {{ option.meta }}
            </span>
            <Check
              class="size-3.5 opacity-0 in-data-[state=checked]:opacity-100"
              aria-hidden="true"
            />
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
