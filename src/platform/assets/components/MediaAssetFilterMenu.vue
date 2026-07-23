<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button
        variant="secondary"
        size="icon"
        class="relative"
        :aria-label="$t('assetBrowser.filterBy')"
      >
        <i class="icon-[lucide--list-filter]" />
        <span
          v-if="active"
          class="absolute top-1 right-1 size-1.5 rounded-full bg-primary-background"
        />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        align="start"
        :side-offset="6"
        :collision-padding="10"
        :style="contentStyle"
        :class="menuClass"
        @open-auto-focus.prevent="focusSearch"
      >
        <MediaAssetFilterSearchRow
          ref="searchRow"
          v-model="query"
          :placeholder="$t('sideToolbar.mediaAssets.filterBy')"
        />

        <div class="max-h-80 overflow-y-auto p-1">
          <template v-if="query.trim()">
            <template v-for="section in searchSections" :key="section.facet">
              <DropdownMenuLabel :class="groupLabelClass">
                {{ catLabel(section.facet) }}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                v-for="row in section.rows"
                :key="row.value"
                :model-value="isApplied(section.facet, row.value)"
                :class="rowClass"
                @select.prevent="toggleFacetValue(section.facet, row.value)"
              >
                <i :class="cn(CAT_ICON[section.facet], iconClass)" />
                <span :class="labelClass">{{ row.text }}</span>
                <i
                  v-if="isApplied(section.facet, row.value)"
                  :class="checkClass"
                />
              </DropdownMenuCheckboxItem>
            </template>
            <div
              v-if="searchSections.length === 0"
              class="px-2 py-1.5 text-sm text-muted-foreground"
            >
              {{ $t('sideToolbar.mediaAssets.filterNoMatches') }}
            </div>
          </template>

          <template v-else>
            <template v-for="group in groups" :key="group.key">
              <DropdownMenuLabel :class="groupLabelClass">
                {{ $t(group.label) }}
              </DropdownMenuLabel>
              <DropdownMenuSub
                v-for="cat in group.cats"
                :key="cat"
                @update:open="resetSubSearch(cat)"
              >
                <DropdownMenuSubTrigger
                  :class="
                    cn(
                      rowClass,
                      'data-[state=open]:bg-secondary-background-hover'
                    )
                  "
                >
                  <i :class="cn(CAT_ICON[cat], iconClass)" />
                  <span :class="labelClass">{{ catLabel(cat) }}</span>
                  <span v-if="appliedCount(cat) > 0" :class="countClass">
                    {{ appliedCount(cat) }}
                  </span>
                  <i
                    class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground"
                  />
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <!-- align first option (not the search row) with the trigger:
                       border+padding = 5; author adds the 40px search row + 1px separator -->
                  <DropdownMenuSubContent
                    :side-offset="2"
                    :align-offset="cat === 'author' ? -46 : -5"
                    :collision-padding="10"
                    :style="contentStyle"
                    :class="menuClass"
                  >
                    <MediaAssetFilterSearchRow
                      v-if="cat === 'author'"
                      v-model="authorQuery"
                      :placeholder="$t('sideToolbar.mediaAssets.searchPeople')"
                    />
                    <div class="p-1">
                      <DropdownMenuCheckboxItem
                        v-for="opt in visibleSubValues(cat)"
                        :key="opt.value"
                        :model-value="isApplied(cat, opt.value)"
                        :class="rowClass"
                        @select.prevent="toggleFacetValue(cat, opt.value)"
                      >
                        <span :class="labelClass">{{ opt.text }}</span>
                        <i
                          v-if="isApplied(cat, opt.value)"
                          :class="checkClass"
                        />
                      </DropdownMenuCheckboxItem>
                      <div
                        v-if="visibleSubValues(cat).length === 0"
                        class="px-2 py-1.5 text-sm text-muted-foreground"
                      >
                        {{ $t('sideToolbar.mediaAssets.filterNoMatches') }}
                      </div>
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </template>
          </template>
        </div>

        <template v-if="anyApplied">
          <DropdownMenuSeparator class="h-px bg-border-subtle" />
          <DropdownMenuItem
            class="flex h-10 items-center px-3 text-sm text-muted-foreground outline-none data-highlighted:text-base-foreground"
            @select.prevent="clearAll"
          >
            {{ $t('sideToolbar.mediaAssets.clearFilters') }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import { AUTHOR_ME } from '../composables/useAssetSharing'
import type { VisibilityFilter } from '../composables/useMediaAssetFiltering'
import {
  DATE_VALUES,
  MEDIA_TYPE_VALUES,
  VISIBILITY_VALUES
} from './mediaAssetFilterFacets'
import type { FacetValue } from './mediaAssetFilterFacets'
import MediaAssetFilterSearchRow from './MediaAssetFilterSearchRow.vue'

type FacetKey = 'author' | 'visibility' | 'media' | 'date'
interface ValueOption {
  value: string
  text: string
}

const { authorOptions, active = false } = defineProps<{
  authorOptions: string[]
  active?: boolean
}>()

const mediaTypeFilters = defineModel<string[]>('mediaTypeFilters', {
  required: true
})
const visibilityFilter = defineModel<VisibilityFilter>('visibilityFilter', {
  required: true
})
const authorFilter = defineModel<string>('authorFilter', { required: true })
const dateFilter = defineModel<string>('dateFilter', { required: true })

const { t } = useI18n()

const open = ref(false)
const contentStyle = useModalLiftedZIndex(open)
const searchRow = ref<InstanceType<typeof MediaAssetFilterSearchRow>>()
const query = ref('')
const authorQuery = ref('')

const menuClass =
  'data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade z-1700 flex w-56 flex-col rounded-lg border border-border-subtle bg-base-background shadow-sm will-change-[opacity,transform]'
const groupLabelClass =
  'px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase'
const rowClass =
  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const iconClass = 'size-4 shrink-0 text-muted-foreground'
const labelClass = 'min-w-0 flex-1 truncate text-left text-base-foreground'
const checkClass = 'icon-[lucide--check] size-4 shrink-0 text-base-foreground'
const countClass =
  'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary-background px-1 text-xs text-muted-foreground tabular-nums'

const CAT_ICON: Record<FacetKey, string> = {
  author: 'icon-[lucide--user]',
  visibility: 'icon-[lucide--eye]',
  media: 'icon-[lucide--image]',
  date: 'icon-[lucide--calendar]'
}
const CAT_LABEL: Record<FacetKey, string> = {
  author: 'sideToolbar.mediaAssets.filterCreatedBy',
  visibility: 'sideToolbar.mediaAssets.visibilityLabel',
  media: 'sideToolbar.mediaAssets.filterMediaType',
  date: 'sideToolbar.mediaAssets.filterDate'
}
const catLabel = (cat: FacetKey) => t(CAT_LABEL[cat])

const groups: { key: string; label: string; cats: FacetKey[] }[] = [
  {
    key: 'sharing',
    label: 'sideToolbar.mediaAssets.filterGroupSharing',
    cats: ['author', 'visibility']
  },
  {
    key: 'attribute',
    label: 'sideToolbar.mediaAssets.filterGroupAttribute',
    cats: ['media', 'date']
  }
]

// Values that clear a single-select facet — excluded from flat search results.
const CLEAR_VALUES = new Set(['', 'all'])

function toOptions(values: FacetValue[]): ValueOption[] {
  return values.map((facetValue) => ({
    value: facetValue.value,
    text: t(facetValue.labelKey)
  }))
}

function valuesFor(cat: FacetKey): ValueOption[] {
  switch (cat) {
    case 'author':
      return [
        { value: '', text: t('sideToolbar.mediaAssets.authorEveryone') },
        ...authorOptions.map((name) => ({
          value: name,
          text:
            name === AUTHOR_ME ? t('sideToolbar.mediaAssets.authorMe') : name
        }))
      ]
    case 'visibility':
      return toOptions(VISIBILITY_VALUES)
    case 'media':
      return toOptions(MEDIA_TYPE_VALUES)
    case 'date':
      return toOptions(DATE_VALUES)
  }
}

// The Created-by list can get long, so its flyout has its own search box that
// narrows only that list.
function visibleSubValues(cat: FacetKey): ValueOption[] {
  const values = valuesFor(cat)
  if (cat !== 'author') return values
  const q = authorQuery.value.trim().toLowerCase()
  if (!q) return values
  return values.filter((opt) => opt.text.toLowerCase().includes(q))
}

function resetSubSearch(cat: FacetKey) {
  if (cat === 'author') authorQuery.value = ''
}

const searchSections = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return groups
    .flatMap((g) => g.cats)
    .map((facet) => ({
      facet,
      rows: valuesFor(facet).filter(
        (o) => !CLEAR_VALUES.has(o.value) && o.text.toLowerCase().includes(q)
      )
    }))
    .filter((s) => s.rows.length)
})

function isApplied(cat: FacetKey, value: string): boolean {
  switch (cat) {
    case 'author':
      return authorFilter.value === value
    case 'visibility':
      return visibilityFilter.value === value
    case 'media':
      return mediaTypeFilters.value.includes(value)
    case 'date':
      return dateFilter.value === value
  }
}

function appliedCount(cat: FacetKey): number {
  switch (cat) {
    case 'author':
      return authorFilter.value ? 1 : 0
    case 'visibility':
      return visibilityFilter.value !== 'all' ? 1 : 0
    case 'media':
      return mediaTypeFilters.value.length
    case 'date':
      return dateFilter.value ? 1 : 0
  }
}

function toggleFacetValue(cat: FacetKey, value: string) {
  switch (cat) {
    case 'author':
      authorFilter.value = authorFilter.value === value ? '' : value
      return
    case 'visibility':
      visibilityFilter.value = (
        visibilityFilter.value === value ? 'all' : value
      ) as VisibilityFilter
      return
    case 'date':
      dateFilter.value = dateFilter.value === value ? '' : value
      return
    case 'media':
      mediaTypeFilters.value = mediaTypeFilters.value.includes(value)
        ? mediaTypeFilters.value.filter((v) => v !== value)
        : [...mediaTypeFilters.value, value]
  }
}

const anyApplied = computed(
  () =>
    mediaTypeFilters.value.length > 0 ||
    visibilityFilter.value !== 'all' ||
    !!authorFilter.value ||
    !!dateFilter.value
)

function clearAll() {
  mediaTypeFilters.value = []
  visibilityFilter.value = 'all'
  authorFilter.value = ''
  dateFilter.value = ''
}

function focusSearch() {
  query.value = ''
  void nextTick(() => searchRow.value?.focus())
}
</script>
