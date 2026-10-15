<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { ref, useId, watch } from 'vue'

import type { FacetSheetGroup } from './FacetSheet.vue'
import FacetOptionList from './FacetOptionList.vue'

const { groups, searchLabel, noMatches } = defineProps<{
  groups: readonly FacetSheetGroup[]
  searchLabel: string
  noMatches: string
}>()

const emit = defineEmits<{ toggle: [group: string, value: string] }>()

const activeKey = ref(groups[0]?.key ?? '')
const search = ref<Record<string, string>>({})
const loneGroupLabelId = `facet-sheet-group-${useId()}`

// A facet that is no longer offered would leave the sheet on an empty tab.
watch(
  () => groups.map((group) => group.key).join(),
  () => {
    if (!groups.some((group) => group.key === activeKey.value))
      activeKey.value = groups[0]?.key ?? ''
  }
)

function visibleOptions(group: FacetSheetGroup) {
  const needle = (search.value[group.key] ?? '').trim().toLowerCase()
  return needle
    ? group.options.filter((option) =>
        option.label.toLowerCase().includes(needle)
      )
    : group.options
}
</script>

<template>
  <TabsRoot v-model="activeKey" class="flex min-h-0 flex-col max-sm:flex-1">
    <!-- One group has nothing to be chosen between. Its name labels the
        region directly without exposing an inoperable tab widget. -->
    <h3 v-if="groups.length === 1" :id="loneGroupLabelId" class="sr-only">
      {{ groups[0]?.label }}
    </h3>
    <TabsList
      v-if="groups.length > 1"
      class="scrollbar-hide flex items-center gap-1 overflow-x-auto border-b border-white/10 p-2 max-sm:px-4 max-sm:pb-3"
    >
      <TabsTrigger
        v-for="group in groups"
        :key="group.key"
        :value="group.key"
        :data-testid="`workshop-facet-${group.key}`"
        class="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-wider whitespace-nowrap text-content-secondary uppercase transition-colors outline-none hover:bg-white/5 hover:text-content focus-visible:ring-2 focus-visible:ring-brand data-[state=active]:bg-white/8 data-[state=active]:text-content"
      >
        {{ group.label }}
        <span
          v-if="group.selected.length"
          class="inline-flex size-4 items-center justify-center rounded-full bg-brand text-2xs font-bold text-page tabular-nums"
          :data-testid="`workshop-facet-${group.key}-count`"
        >
          {{ group.selected.length }}
        </span>
      </TabsTrigger>
    </TabsList>

    <TabsContent
      v-for="group in groups"
      :key="group.key"
      :value="group.key"
      v-bind="
        groups.length === 1
          ? {
              role: 'region',
              'aria-labelledby': loneGroupLabelId,
              tabindex: -1
            }
          : {}
      "
      class="flex min-h-0 flex-col outline-none max-sm:flex-1"
    >
      <div class="border-b border-white/10 p-2 max-sm:px-4 max-sm:py-3">
        <input
          v-model="search[group.key]"
          type="search"
          :placeholder="searchLabel"
          :aria-label="searchLabel"
          :data-testid="`workshop-filter-${group.key}-search`"
          class="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-content outline-none placeholder:text-content-muted focus-visible:ring-2 focus-visible:ring-brand max-sm:py-2.5 max-sm:text-base [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <!-- On a phone the list takes whatever the sheet's own height leaves,
          so switching tab does not resize it under the thumb. On a pointer the
          popover hugs its list instead of standing half empty. -->
      <FacetOptionList
        :group
        :options="visibleOptions(group)"
        :no-matches
        class="scrollbar-thin overflow-y-auto py-1 max-sm:min-h-0 max-sm:flex-1 sm:max-h-72 sm:min-h-32"
        @toggle="(key, value) => emit('toggle', key, value)"
      />
    </TabsContent>
  </TabsRoot>
</template>
