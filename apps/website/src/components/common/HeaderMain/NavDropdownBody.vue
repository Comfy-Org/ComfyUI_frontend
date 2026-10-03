<script setup lang="ts">
import { computed } from 'vue'

import type {
  NavColumn as NavColumnData,
  NavFeatured
} from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'

const { columns } = defineProps<{
  columns: NavColumnData[]
  featured?: NavFeatured
  locale: Locale
  currentPath: string
}>()

const main = computed(() =>
  columns.filter((column) => column.placement !== 'footer')
)
const footer = computed(() =>
  columns.filter((column) => column.placement === 'footer')
)
</script>

<template>
  <ul class="flex w-max gap-16">
    <NavFeaturedCard v-if="featured" :featured />
    <li class="flex flex-col gap-8">
      <ul class="flex gap-16">
        <NavColumn
          v-for="column in main"
          :key="column.header"
          :column
          :locale
          :current-path
        />
      </ul>
      <ul
        v-if="footer.length"
        class="border-t border-transparency-white-t8 pt-4"
      >
        <NavColumn
          v-for="column in footer"
          :key="column.header"
          :column
          :locale
          :current-path
        />
      </ul>
    </li>
  </ul>
</template>
