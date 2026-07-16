<script setup lang="ts">
import { PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'

interface Option {
  name: string
  value: string
}

const {
  label,
  options,
  icon,
  searchPlaceholder
} = defineProps<{
  label: string
  options: Option[]
  icon?: string
  searchPlaceholder?: string
}>()

const model = defineModel<string[]>({ default: () => [] })

const { t } = useI18n()
const open = ref(false)

const selectedCount = computed(() => model.value.length)

const isSelected = (value: string) => model.value.includes(value)

const toggle = (value: string) => {
  const next = new Set(model.value)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  model.value = [...next]
}

const clearAll = () => {
  model.value = []
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="label"
        class="relative flex h-8 w-full cursor-pointer appearance-none items-center gap-1.5 rounded-lg border border-border-subtle bg-transparent px-3 text-xs text-base-foreground outline-none transition-colors hover:bg-secondary-background-hover"
      >
        <i
          v-if="icon"
          :class="icon"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <span class="min-w-0 flex-1 truncate text-left">{{ label }}</span>
        <span
          v-if="selectedCount > 0"
          class="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-base-foreground text-xs font-semibold text-base-background"
        >
          {{ selectedCount }}
        </span>
        <i
          class="icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground"
        />
      </button>
    </PopoverTrigger>

    <PopoverContent
      align="start"
      class="w-(--reka-popover-trigger-width) min-w-56 p-0"
    >
      <Command>
        <CommandInput :placeholder="searchPlaceholder ?? t('g.search')" />
        <CommandList>
          <CommandEmpty>{{ t('g.noResultsFound') }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              @select="toggle(option.value)"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors"
                :class="
                  isSelected(option.value)
                    ? 'bg-primary-background'
                    : 'bg-secondary-background'
                "
              >
                <i
                  v-if="isSelected(option.value)"
                  class="icon-[lucide--check] size-3 text-base-foreground"
                />
              </span>
              <span class="truncate">{{ option.name }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div
          v-if="options.length > 0"
          class="flex items-center justify-between border-t border-border-default px-4 pt-2 pb-1"
        >
          <span class="text-sm text-muted-foreground">
            {{ t('g.itemsSelected', { count: selectedCount }) }}
          </span>
          <Button variant="textonly" size="md" @click="clearAll">
            {{ t('g.clearAll') }}
          </Button>
        </div>
      </Command>
    </PopoverContent>
  </Popover>
</template>
