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
  <ul class="flex w-max gap-10">
    <li class="flex flex-col gap-8">
      <div
        v-if="exploreLink"
        class="-mb-2 flex items-center justify-between gap-8 border-b border-transparency-white-t8 pb-4"
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
    <NavFeaturedCard v-if="featured" :featured />
  </ul>
</template>
