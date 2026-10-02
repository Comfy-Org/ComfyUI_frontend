<script setup lang="ts">
import { computed } from 'vue'
import NavigationMenu from '@/components/ui/navigation-menu/NavigationMenu.vue'
import NavigationMenuContent from '@/components/ui/navigation-menu/NavigationMenuContent.vue'
import NavigationMenuItem from '@/components/ui/navigation-menu/NavigationMenuItem.vue'
import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'
import NavigationMenuList from '@/components/ui/navigation-menu/NavigationMenuList.vue'
import NavigationMenuTrigger from '@/components/ui/navigation-menu/NavigationMenuTrigger.vue'
import { cn } from '@comfyorg/tailwind-utils'

import { navigationMenuTriggerStyle } from '@/components/ui/navigation-menu/navigationMenuTriggerStyle'

import {
  isHrefActive,
  useCurrentPath
} from '../../../composables/useCurrentPath'
import { getMainNavigation } from '../../../data/mainNavigation'
import type { NavItem } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'
import NewBadge from './NewBadge.vue'

const { locale = 'en', workshopInBuild = false } = defineProps<{
  locale?: Locale
  workshopInBuild?: boolean
}>()
const mainNavigation = computed(() =>
  getMainNavigation(locale, workshopInBuild)
)
const currentPath = useCurrentPath()

function isNavItemActive(navItem: NavItem, path: string): boolean {
  if (navItem.href) return isHrefActive(navItem.href, path)
  const onLeafPage = mainNavigation.value.some(
    (item) => item.href && isHrefActive(item.href, path)
  )
  const hrefs = [
    ...(navItem.featured ? [navItem.featured.cta.href] : []),
    ...(navItem.columns?.flatMap((column) =>
      column.items.map((item) => item.href)
    ) ?? [])
  ]
  return !onLeafPage && hrefs.some((href) => isHrefActive(href, path))
}
</script>

<template>
  <NavigationMenu data-testid="desktop-nav-links">
    <NavigationMenuList>
      <NavigationMenuItem
        v-for="navItem in mainNavigation"
        :key="navItem.label"
      >
        <template v-if="navItem.columns?.length">
          <NavigationMenuTrigger
            :active="isNavItemActive(navItem, currentPath)"
          >
            <span class="inline-flex items-center gap-1">
              <span>{{ navItem.label }}</span>
              <span v-if="navItem.badge" class="hidden 2xl:inline-flex">
                <NewBadge :locale="locale" size="xxs" />
              </span>
            </span>
          </NavigationMenuTrigger>
          <NavigationMenuContent class="w-auto" data-testid="nav-dropdown">
            <ul class="flex w-max gap-16">
              <NavFeaturedCard
                v-if="navItem.featured"
                :featured="navItem.featured"
              />
              <li class="flex flex-col gap-8">
                <ul class="flex gap-16">
                  <NavColumn
                    v-for="column in navItem.columns.filter(
                      (column) => column.placement !== 'footer'
                    )"
                    :key="column.header"
                    :column="column"
                    :locale="locale"
                    :current-path="currentPath"
                  />
                </ul>
                <ul
                  v-if="navItem.columns.some((c) => c.placement === 'footer')"
                  class="border-t border-transparency-white-t8 pt-4"
                >
                  <NavColumn
                    v-for="column in navItem.columns.filter(
                      (column) => column.placement === 'footer'
                    )"
                    :key="column.header"
                    :column="column"
                    :locale="locale"
                    :current-path="currentPath"
                  />
                </ul>
              </li>
            </ul>
          </NavigationMenuContent>
        </template>
        <NavigationMenuLink
          v-else
          as-child
          :active="isNavItemActive(navItem, currentPath)"
          :class="
            cn(navigationMenuTriggerStyle(), 'flex-row gap-1 whitespace-nowrap')
          "
        >
          <a :href="navItem.href">
            <span class="inline-block">{{ navItem.label }}</span>
            <span v-if="navItem.badge" class="hidden 2xl:inline-flex">
              <NewBadge :locale="locale" size="xxs" />
            </span>
          </a>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
