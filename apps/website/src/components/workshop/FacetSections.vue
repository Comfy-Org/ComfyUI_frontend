<script setup lang="ts">
import { useId } from 'vue'

import type { FacetSheetGroup } from './FacetSheet.vue'
import FacetOptionList from './FacetOptionList.vue'

const { groups, noMatches } = defineProps<{
  groups: readonly FacetSheetGroup[]
  noMatches: string
}>()

const emit = defineEmits<{ toggle: [group: string, value: string] }>()

const headingId = `facet-section-${useId()}`
</script>

<template>
  <div
    class="flex min-h-0 scrollbar-thin flex-col overflow-y-auto py-1 max-sm:flex-1 sm:max-h-96"
    data-testid="workshop-filter-sections"
  >
    <section
      v-for="group in groups"
      :key="group.key"
      :aria-labelledby="`${headingId}-${group.key}`"
    >
      <h3
        :id="`${headingId}-${group.key}`"
        class="px-3 pt-3 pb-1 text-xs font-semibold tracking-wider text-content-secondary uppercase max-sm:px-4"
      >
        {{ group.label }}
      </h3>
      <FacetOptionList
        :group
        :options="group.options"
        :no-matches
        @toggle="(key, value) => emit('toggle', key, value)"
      />
    </section>
  </div>
</template>
