<script setup lang="ts">
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu'

import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'
import { getMainNavigation } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const mainNavigation = getMainNavigation(locale)
</script>

<template>
  <NavigationMenu data-testid="desktop-nav-links">
    <NavigationMenuList>
      <NavigationMenuItem
        v-for="navItem in mainNavigation"
        :key="navItem.label"
      >
        <template v-if="navItem.columns?.length">
          <NavigationMenuTrigger>{{ navItem.label }}</NavigationMenuTrigger>
          <NavigationMenuContent class="w-auto">
            <ul class="flex w-max gap-16">
              <NavFeaturedCard
                v-if="navItem.featured"
                :featured="navItem.featured"
              />
              <NavColumn
                v-for="column in navItem.columns"
                :key="column.header"
                :column="column"
                :locale="locale"
              />
            </ul>
          </NavigationMenuContent>
        </template>
        <NavigationMenuLink
          v-else
          as-child
          :class="navigationMenuTriggerStyle()"
        >
          <a :href="navItem.href" class="ppformula-text-center">{{
            navItem.label
          }}</a>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
