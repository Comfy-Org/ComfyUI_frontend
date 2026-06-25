<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import { cn } from '@comfyorg/tailwind-utils'

import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import type { LayoutMode, SortOption } from './types'

const { t } = useI18n()

defineProps<{
  sortOptions: SortOption[]
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
  candidateLabel?: string
}>()
const emit = defineEmits<{
  (e: 'search-enter'): void
}>()

const layoutMode = defineModel<LayoutMode>('layoutMode')
const searchQuery = defineModel<string>('searchQuery')
const sortSelected = defineModel<string>('sortSelected')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected', {
  default: 'all'
})
const baseModelSelected = defineModel<Set<string>>('baseModelSelected', {
  default: () => new Set()
})

const actionButtonStyle = cn(
  'h-8 rounded-lg bg-zinc-500/20 outline-1 -outline-offset-1 outline-node-component-border transition-all duration-150'
)

const layoutSwitchItemStyle =
  'size-6 flex justify-center items-center rounded-sm cursor-pointer transition-all duration-150 hover:scale-108 hover:text-base-foreground active:scale-95'

function toggleBaseModelSelection(item: FilterOption) {
  const current = new Set(baseModelSelected.value)
  baseModelSelected.value = current.has(item.value)
    ? new Set([...current].filter((v) => v !== item.value))
    : new Set([...current, item.value])
}

function handleSearchEnter(event: KeyboardEvent) {
  event.preventDefault()
  emit('search-enter')
}
</script>

<template>
  <div class="text-secondary flex gap-2 px-4">
    <AsyncSearchInput
      v-model="searchQuery"
      autofocus
      :class="
        cn(
          actionButtonStyle,
          'hover:outline-component-node-widget-background-highlighted/80',
          'focus-within:ring-0 focus-within:outline-component-node-widget-background-highlighted/80'
        )
      "
      @enter="handleSearchEnter"
    />
    <span
      v-if="candidateLabel"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ t('widgets.uploadSelect.topResult', { result: candidateLabel }) }}
    </span>

    <DropdownMenu :modal="false">
      <DropdownMenuTrigger as-child>
        <Button
          :aria-label="t('assetBrowser.sortBy')"
          :title="t('assetBrowser.sortBy')"
          variant="textonly"
          size="icon"
          :class="
            cn(
              actionButtonStyle,
              'relative w-8 hover:outline-component-node-widget-background-highlighted active:scale-95'
            )
          "
        >
          <div
            v-if="sortSelected !== 'default'"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
          />
          <i class="icon-[lucide--arrow-up-down] size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent size="lg" align="end" :side-offset="4">
        <DropdownMenuItem
          v-for="item of sortOptions"
          :key="item.name"
          checkable
          :checked="sortSelected === item.id"
          @select="sortSelected = item.id"
        >
          {{ item.name }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu
      v-if="showOwnershipFilter && ownershipOptions?.length"
      :modal="false"
    >
      <DropdownMenuTrigger as-child>
        <Button
          :aria-label="t('assetBrowser.ownership')"
          :title="t('assetBrowser.ownership')"
          variant="textonly"
          size="icon"
          :class="
            cn(
              actionButtonStyle,
              'relative w-8 hover:outline-component-node-widget-background-highlighted active:scale-95'
            )
          "
        >
          <div
            v-if="ownershipSelected !== 'all'"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
          />
          <i class="icon-[lucide--user] size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent size="lg" align="end" :side-offset="4">
        <DropdownMenuItem
          v-for="item of ownershipOptions"
          :key="item.value"
          checkable
          :checked="ownershipSelected === item.value"
          @select="ownershipSelected = item.value"
        >
          {{ item.name }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu
      v-if="showBaseModelFilter && baseModelOptions?.length"
      :modal="false"
    >
      <DropdownMenuTrigger as-child>
        <Button
          :aria-label="t('assetBrowser.baseModel')"
          :title="t('assetBrowser.baseModel')"
          variant="textonly"
          size="icon"
          :class="
            cn(
              actionButtonStyle,
              'relative w-8 hover:outline-component-node-widget-background-highlighted active:scale-95'
            )
          "
        >
          <div
            v-if="baseModelSelected.size > 0"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
          />
          <i class="icon-[comfy--ai-model] size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent size="lg" align="end" :side-offset="4">
        <DropdownMenuItem
          v-for="item of baseModelOptions"
          :key="item.value"
          checkable
          :checked="baseModelSelected.has(item.value)"
          @select="
            (event: Event) => {
              event.preventDefault()
              toggleBaseModelSelection(item)
            }
          "
        >
          {{ item.name }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="baseModelSelected = new Set()">
          {{ t('g.clearFilters') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <div
      :class="
        cn(
          actionButtonStyle,
          'flex items-center justify-center gap-1 p-1 hover:outline-component-node-widget-background-highlighted'
        )
      "
    >
      <Button
        :aria-label="t('assetBrowser.listView')"
        :title="t('assetBrowser.listView')"
        variant="textonly"
        size="unset"
        :class="
          cn(
            layoutSwitchItemStyle,
            layoutMode === 'list' && 'bg-neutral-500/50 text-base-foreground'
          )
        "
        @click="layoutMode = 'list'"
      >
        <i class="icon-[lucide--list] size-4" />
      </Button>
      <Button
        :aria-label="t('assetBrowser.gridView')"
        :title="t('assetBrowser.gridView')"
        variant="textonly"
        size="unset"
        :class="
          cn(
            layoutSwitchItemStyle,
            layoutMode === 'grid' && 'bg-neutral-500/50 text-base-foreground'
          )
        "
        @click="layoutMode = 'grid'"
      >
        <i class="icon-[lucide--layout-grid] size-4" />
      </Button>
    </div>
  </div>
</template>
