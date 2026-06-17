<script setup lang="ts">
import BreadthumbIcon from '@/components/icons/BreadthumbIcon.vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { getMainNavigation } from '../../../data/mainNavigation'
import { externalLinks, getRoutes } from '../../../config/routes.ts'
import { lockScroll, unlockScroll } from '../../../composables/scrollLock'
import type { Locale } from '../../../i18n/translations.ts'
import { t } from '../../../i18n/translations.ts'
import NavLinkContent from './NavLinkContent.vue'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '../../ui/sheet/index.ts'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
const mainNavigation = getMainNavigation(locale)

const ctaButtons = [
  {
    label: t('nav.downloadLocal', locale),
    href: routes.download,
    primary: false
  },
  {
    label: t('nav.launchCloud', locale),
    href: externalLinks.cloud,
    primary: true
  }
]

const isOpen = ref(false)
const activeSection = ref<string | null>(null)

const activeItem = computed(() =>
  mainNavigation.find(
    (item) => item.label === activeSection.value && item.columns
  )
)

watch(isOpen, (open) => {
  if (open) {
    lockScroll()
  } else {
    unlockScroll()
    activeSection.value = null
  }
})

onUnmounted(() => {
  if (isOpen.value) unlockScroll({ skipRestore: true })
})
</script>

<template>
  <div>
    <Sheet v-model:open="isOpen">
      <SheetTrigger
        :aria-label="t('nav.toggleMenu', locale)"
        class="bg-primary-comfy-yellow grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-primary-comfy-ink hover:opacity-90"
      >
        <BreadthumbIcon class="h-3 w-5 text-primary-comfy-ink" />
      </SheetTrigger>
      <SheetContent
        side="right"
        class="flex size-full flex-col px-6 py-5 sm:max-w-none"
        :close-label="t('nav.close', locale)"
      >
        <SheetHeader class="sr-only">
          <SheetTitle>{{ t('nav.menu', locale) }}</SheetTitle>
          <SheetDescription>
            {{ t('nav.mobileMenuDescription', locale) }}
          </SheetDescription>
        </SheetHeader>

        <div>
          <a
            :href="routes.home"
            class="focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex w-auto shrink-0 focus-visible:ring-3"
          >
            <img src="/icons/logomark.svg" alt="" class="h-11 w-auto" />
            <span class="sr-only">{{ t('nav.home', locale) }}</span>
          </a>
        </div>

        <div class="relative mt-10 flex-1 overflow-hidden">
          <!-- Top-level nav -->
          <nav
            :class="
              cn(
                'absolute inset-0 overflow-y-auto p-1',
                activeItem ? 'opacity-0' : ''
              )
            "
            :aria-label="t('nav.menu', locale)"
            :inert="activeItem ? true : undefined"
          >
            <ul class="flex flex-col gap-y-8">
              <li v-for="item in mainNavigation" :key="item.label">
                <Button
                  :as="item.columns ? 'button' : 'a'"
                  variant="navMuted"
                  :type="item.columns ? 'button' : undefined"
                  :href="item.columns ? undefined : item.href"
                  @click="item.columns && (activeSection = item.label)"
                >
                  {{ item.label }}
                  <template #append>
                    <ChevronRight class="size-7" />
                  </template>
                </Button>
              </li>
            </ul>
          </nav>

          <!-- Drill-down sub-panel -->
          <div
            class="absolute inset-0 overflow-y-auto bg-primary-comfy-ink transition-transform duration-300 ease-out"
            :class="
              activeItem
                ? 'translate-x-0'
                : 'pointer-events-none translate-x-full'
            "
            :inert="activeItem ? undefined : true"
            :aria-hidden="!activeItem"
          >
            <Button type="button" variant="link" @click="activeSection = null">
              <template #prepend>
                <ChevronLeft />
              </template>
              {{ t('nav.back', locale) }}
            </Button>

            <div v-if="activeItem" class="mt-6 flex flex-col gap-y-12">
              <div
                v-for="column in activeItem.columns"
                :key="column.header"
                class="flex flex-col gap-y-3"
              >
                <p
                  class="text-primary-warm-gray text-base font-bold tracking-wider uppercase"
                >
                  {{ column.header }}
                </p>
                <Button
                  v-for="link in column.items"
                  :key="link.label"
                  :href="link.href"
                  variant="nav"
                  as="a"
                  :target="link.external ? '_blank' : undefined"
                  :rel="link.external ? 'noopener noreferrer' : undefined"
                >
                  <NavLinkContent :item="link" :locale="locale" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter class="gap-3 p-0 pt-6">
          <Button
            v-for="cta in ctaButtons"
            :key="cta.href"
            :href="cta.href"
            :variant="cta.primary ? 'default' : 'outline'"
            size="lg"
            class="w-full"
          >
            {{ cta.label }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>
