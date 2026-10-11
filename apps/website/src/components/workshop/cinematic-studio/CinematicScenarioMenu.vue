<script setup lang="ts">
import { Check, Ellipsis } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

interface ScenarioOption {
  readonly id: string
  readonly label: string
}

const { apps, layouts, appHeading, layoutHeading } = defineProps<{
  apps: readonly ScenarioOption[]
  layouts: readonly ScenarioOption[]
  appHeading: string
  layoutHeading: string
}>()

const app = defineModel<string>('app', { required: true })
const layout = defineModel<string>('layout', { required: true })

const labelOf = (options: readonly ScenarioOption[], id: string) =>
  options.find((option) => option.id === id)?.label ?? id
const triggerLabel = computed(
  () =>
    `${layoutHeading}: ${labelOf(apps, app.value)} · ${labelOf(layouts, layout.value)}`
)
const groups = computed(() => [
  { key: 'app', heading: appHeading, options: apps, model: app },
  { key: 'layout', heading: layoutHeading, options: layouts, model: layout }
])
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :aria-label="triggerLabel"
      class="fixed right-3 bottom-56 z-60 flex size-8 items-center justify-center rounded-full border border-transparency-white-t20 bg-primary-comfy-ink-light text-primary-comfy-canvas shadow-lg outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:right-5 lg:bottom-5"
    >
      <Ellipsis class="size-4" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="top"
        align="end"
        :side-offset="8"
        :collision-padding="8"
        class="z-60 min-w-72 rounded-2xl border border-transparency-white-t8 bg-site-dropdown p-1.5 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <template v-for="(group, index) in groups" :key="group.key">
          <DropdownMenuSeparator
            v-if="index > 0"
            class="my-1.5 h-px bg-transparency-white-t8"
          />
          <DropdownMenuLabel
            class="px-2.5 pt-1.5 pb-1 text-xs text-primary-warm-gray"
          >
            {{ group.heading }}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="group.model.value">
            <DropdownMenuRadioItem
              v-for="option in group.options"
              :key="option.id"
              :value="option.id"
              class="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-primary-warm-white outline-none data-highlighted:bg-transparency-white-t8"
            >
              <span class="flex-1">{{ option.label }}</span>
              <Check
                class="size-3.5 opacity-0 in-data-[state=checked]:opacity-100"
                aria-hidden="true"
              />
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
