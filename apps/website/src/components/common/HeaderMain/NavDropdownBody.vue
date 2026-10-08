<script setup lang="ts">
import { computed } from 'vue'

import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '@/composables/useCurrentPath'
import type {
  NavColumn as NavColumnData,
  NavExploreLink,
  NavFeatured
} from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'
import NavLinkContent from './NavLinkContent.vue'

const { columns } = defineProps<{
  columns: NavColumnData[]
  featured?: NavFeatured
  exploreLink?: NavExploreLink
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
  <div class="w-max">
    <div
      v-if="exploreLink"
      class="mb-6 flex items-center justify-between gap-8 border-b border-transparency-white-t8 pb-4"
      data-testid="nav-explore-row"
    >
      <p class="pl-2 text-sm text-primary-warm-gray">
        {{ exploreLink.intro }}
      </p>
      <NavigationMenuLink
        as-child
        :active="isHrefActive(exploreLink.href, currentPath)"
        class="shrink-0 hover:bg-transparency-white-t4"
      >
        <a :href="exploreLink.href" data-testid="nav-explore-link">
          <NavLinkContent
            :item="{ label: exploreLink.label, seeAll: true }"
            :locale
          />
        </a>
      </NavigationMenuLink>
    </div>
    <ul class="flex gap-16">
      <NavFeaturedCard v-if="featured" :featured />
      <NavColumn
        v-for="(column, columnIndex) in main"
        :key="column.header ?? columnIndex"
        :column
        :locale
        :current-path
      />
    </ul>
    <ul
      v-if="footer.length"
      class="mt-6 border-t border-primary-warm-gray/20 pt-5"
    >
      <NavColumn
        v-for="(column, columnIndex) in footer"
        :key="column.header ?? columnIndex"
        :column
        :locale
        :current-path
        layout="row"
      />
    </ul>
  </div>
</template>
