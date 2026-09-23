<script setup lang="ts">
import { ChevronDown, Cpu } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'

const { models, locale = 'en' } = defineProps<{
  /** Every model the workflows on this tab name, most used first. */
  models: readonly string[]
  locale?: Locale
}>()

const chosen = defineModel<string>({ required: true })

const control =
  'inline-flex h-11 max-w-56 cursor-pointer items-center gap-2 rounded-2xl bg-transparency-white-t4 px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:h-10 max-sm:rounded-xl'

const menuItem =
  'flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-content-secondary outline-none select-none hover:bg-transparency-white-t4 hover:text-content-bright focus-visible:bg-transparency-white-t4'
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :class="cn(control, 'group')"
      :aria-label="tHub('workshop.v2.model.filter', locale)"
      data-testid="catalogue-model-filter"
    >
      <Cpu class="size-4 shrink-0" aria-hidden="true" />
      <span class="truncate max-sm:hidden">
        {{ chosen || tHub('workshop.v2.model.allModels', locale) }}
      </span>
      <ChevronDown
        class="size-4 shrink-0 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180 max-sm:hidden"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-50 max-h-96 w-64 overflow-y-auto rounded-2xl border border-primary-comfy-ink-light bg-site-dropdown p-2 shadow-lg"
      >
        <DropdownMenuRadioGroup v-model="chosen">
          <DropdownMenuRadioItem
            value=""
            :class="
              cn(
                menuItem,
                chosen === '' && 'bg-transparency-white-t8 text-content-bright'
              )
            "
            data-testid="catalogue-model-all"
          >
            {{ tHub('workshop.v2.model.allModels', locale) }}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            v-for="name in models"
            :key="name"
            :value="name"
            :class="
              cn(
                menuItem,
                chosen === name &&
                  'bg-transparency-white-t8 text-content-bright'
              )
            "
          >
            {{ name }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
