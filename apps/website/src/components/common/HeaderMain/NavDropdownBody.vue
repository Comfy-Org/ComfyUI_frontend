<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '@/composables/useCurrentPath'
import type {
  NavColumn as NavColumnData,
  NavFeatured,
  NavFooterLink
} from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'

const { columns } = defineProps<{
  columns: NavColumnData[]
  featured?: NavFeatured
  footerLink?: NavFooterLink
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
      <NavigationMenuLink
        v-if="footerLink"
        as-child
        :active="isHrefActive(footerLink.href, currentPath)"
        class="flex-row items-center justify-between gap-4 rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 px-5 py-4 hover:bg-transparency-white-t8 data-active:bg-transparency-white-t4 data-active:hover:bg-transparency-white-t8"
      >
        <a :href="footerLink.href" data-testid="nav-footer-link">
          <span class="flex min-w-0 flex-col">
            <span class="text-base font-medium text-primary-warm-white">
              {{ footerLink.label }}
            </span>
            <span class="text-sm text-primary-warm-gray">
              {{ footerLink.description }}
            </span>
          </span>
          <span
            class="grid size-10 shrink-0 place-items-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink"
            aria-hidden="true"
          >
            <ArrowRight class="size-5" />
          </span>
        </a>
      </NavigationMenuLink>
    </li>
  </ul>
</template>
