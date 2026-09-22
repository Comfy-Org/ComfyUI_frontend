<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronDown } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TabsList,
  TabsTrigger
} from 'reka-ui'

const {
  tabs,
  label,
  picker = 'tabs'
} = defineProps<{
  tabs: Record<string, { name: string }>
  label: string
  /** Offer the samples as a row of tabs or behind one dropdown. */
  picker?: 'tabs' | 'dropdown'
  listClass?: string
  triggerClass?: string
}>()

const activeTab = defineModel<string>({ required: true })
</script>

<template>
  <DropdownMenuRoot v-if="picker === 'dropdown'">
    <DropdownMenuTrigger
      class="group inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 bg-primary-comfy-ink px-5 py-3 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors outline-none hover:border-white/30 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50"
    >
      <span class="ppformula-text-center inline-block">{{ tabs[activeTab]?.name }}</span>
      <ChevronDown
        class="size-4 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :aria-label="label"
        align="start"
        :side-offset="8"
        class="z-50 min-w-(--reka-dropdown-menu-trigger-width) rounded-2xl border border-white/10 bg-site-dropdown p-1 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuRadioGroup v-model="activeTab">
          <DropdownMenuRadioItem
            v-for="(tab, tabId) in tabs"
            :key="tabId"
            :value="tabId"
            class="flex cursor-pointer items-center rounded-xl px-4 py-2 text-xs font-bold tracking-wider text-smoke-700 uppercase outline-none select-none data-highlighted:text-primary-comfy-canvas data-[state=checked]:bg-secondary-mauve data-[state=checked]:text-primary-warm-white"
          >
            <span class="ppformula-text-center inline-block">{{ tab.name }}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <TabsList
    v-else
    :aria-label="label"
    :class="
      cn(
        'scrollbar-none flex w-full max-w-full overflow-x-auto rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 sm:inline-flex sm:w-auto',
        listClass
      )
    "
  >
    <TabsTrigger
      v-for="(tab, tabId) in tabs"
      :key="tabId"
      :value="tabId"
      :class="
        cn(
          'flex-1 cursor-pointer rounded-xl px-1 py-2 text-center text-[10px] font-bold tracking-normal whitespace-nowrap text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none data-[state=active]:bg-secondary-mauve data-[state=active]:text-primary-warm-white sm:flex-none sm:px-5 sm:text-xs sm:tracking-wider',
          triggerClass
        )
      "
    >
      <span class="ppformula-text-center inline-block">{{ tab.name }}</span>
    </TabsTrigger>
  </TabsList>
</template>
