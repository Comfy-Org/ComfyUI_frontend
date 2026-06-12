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
import Badge from '@/components/common/Badge.vue'
import PillButton from './PillButton.vue'

type NavColumnItem = {
  label: string
  href: string
  badge?: string
}

type NavColumn = {
  header: string
  items: NavColumnItem[]
}

type NavFeatured = {
  imageSrc: string
  imageAlt?: string
  title: string
  cta: {
    label: string
    ariaLabel?: string
    href: string
  }
}

type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      href?: never
    }
  | { label: string; href: string; columns?: never; featured?: never }

const mainNavigation: NavItem[] = [
  {
    label: 'Products',
    featured: {
      imageSrc:
        'https://media.comfy.org/website/customers/moment-factory/hero.webp',
      imageAlt: 'Moment Factory hero image',
      title: 'NEW RELEASE: SEEDANCE 2.0',
      cta: {
        label: 'Try Workflow',
        ariaLabel: 'Try the Seedance 2.0 new release Workflow',
        href: '#'
      }
    },
    columns: [
      {
        header: 'Products',
        items: [
          { label: 'Comfy Desktop', href: '/download' },
          { label: 'Comfy Cloud', href: '/cloud' },
          { label: 'Comfy API', href: '/api', badge: 'new' },
          { label: 'Comfy Enterprise', href: '/cloud/enterprise' }
        ]
      },
      {
        header: 'Features',
        items: [
          { label: 'MCP Server', href: '#', badge: 'new' },
          { label: 'App Mode', href: '#' },
          { label: 'Agent Skills', href: '#' },
          { label: 'Docs', href: '#' }
        ]
      }
    ]
  },
  { label: 'Pricing', href: '/pricing' }
]
</script>

<template>
  <NavigationMenu :viewport="false" data-testid="desktop-nav-links">
    <NavigationMenuList>
      <NavigationMenuItem
        v-for="navItem in mainNavigation"
        :key="navItem.label"
      >
        <template v-if="navItem.columns?.length">
          <NavigationMenuTrigger>{{ navItem.label }}</NavigationMenuTrigger>
          <NavigationMenuContent class="w-auto">
            <ul class="flex space-x-16">
              <li v-if="navItem.featured" class="relative shrink-0">
                <img
                  class="aspect-4/3 w-62 max-w-none rounded-xl"
                  :src="navItem.featured.imageSrc"
                  :alt="navItem.featured.imageAlt ?? ''"
                />
                <p class="mt-4 font-extrabold uppercase">
                  {{ navItem.featured.title }}
                </p>
                <PillButton
                  :href="navItem.featured.cta.href"
                  :aria-label="navItem.featured.cta.ariaLabel"
                  variant="ghost"
                >
                  {{ navItem.featured.cta.label }}
                </PillButton>
              </li>

              <li
                v-for="column in navItem.columns"
                :key="column.header"
                class="flex flex-col space-y-4"
              >
                <p
                  class="font-formula text-primary-warm-gray pl-2 text-sm font-medium"
                >
                  {{ column.header }}
                </p>
                <ul class="flex flex-col">
                  <li v-for="item in column.items" :key="item.label">
                    <NavigationMenuLink
                      as-child
                      class="hover:bg-transparency-white-t4"
                    >
                      <a
                        :href="item.href"
                        class="flex flex-row items-center gap-2 whitespace-nowrap"
                      >
                        <span>{{ item.label }}</span>
                        <Badge v-if="item.badge" size="xs" variant="accent">
                          {{ item.badge }}
                        </Badge>
                      </a>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </li>
            </ul>
          </NavigationMenuContent>
        </template>
        <NavigationMenuLink
          v-else
          as-child
          :class="navigationMenuTriggerStyle()"
        >
          <a :href="navItem.href">{{ navItem.label }}</a>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
