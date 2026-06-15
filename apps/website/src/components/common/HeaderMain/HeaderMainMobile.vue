<script setup lang="ts">
import BreadthumbIcon from '@/components/icons/BreadthumbIcon.vue'
import Badge from '@/components/common/Badge.vue'
import { ArrowUpRight, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { getMainNavigation } from '../../../data/mainNavigation'
import { externalLinks, getRoutes } from '../../../config/routes.ts'
import { lockScroll, unlockScroll } from '../../../composables/scrollLock'
import type { Locale } from '../../../i18n/translations.ts'
import { t } from '../../../i18n/translations.ts'
import BrandButton from '../BrandButton.vue'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '../../ui/sheet/index.ts'

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

        <a
          :href="routes.home"
          class="inline-block shrink-0"
          aria-label="Comfy home"
        >
          <img src="/icons/logomark.svg" alt="Comfy" class="h-11 w-auto" />
        </a>

        <div class="relative mt-8 flex-1 overflow-hidden">
          <!-- Top-level nav -->
          <nav
            class="absolute inset-0 overflow-y-auto"
            :aria-label="t('nav.menu', locale)"
            :inert="activeItem ? true : undefined"
          >
            <ul class="flex flex-col">
              <li v-for="item in mainNavigation" :key="item.label">
                <button
                  v-if="item.columns"
                  type="button"
                  class="text-primary-warm-gray hover:text-primary-warm-white flex w-full cursor-pointer items-center justify-between py-4 text-2xl font-medium tracking-wider uppercase"
                  @click="activeSection = item.label"
                >
                  {{ item.label }}
                  <ChevronRight class="size-5" />
                </button>
                <a
                  v-else
                  :href="item.href"
                  class="text-primary-warm-gray hover:text-primary-warm-white flex items-center justify-between py-4 text-2xl font-medium tracking-wider uppercase"
                >
                  {{ item.label }}
                  <ChevronRight class="size-5" />
                </a>
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
            <button
              type="button"
              class="text-primary-comfy-yellow flex cursor-pointer items-center gap-2 py-2 text-sm font-bold tracking-wider uppercase"
              @click="activeSection = null"
            >
              <ChevronLeft class="size-4" />
              {{ t('nav.back', locale) }}
            </button>

            <div v-if="activeItem" class="mt-6 flex flex-col gap-8">
              <div
                v-for="column in activeItem.columns"
                :key="column.header"
                class="flex flex-col gap-3"
              >
                <p
                  class="text-primary-warm-gray text-xs font-bold tracking-wider uppercase"
                >
                  {{ column.header }}
                </p>
                <a
                  v-for="link in column.items"
                  :key="link.label"
                  :href="link.href"
                  :target="link.external ? '_blank' : undefined"
                  :rel="link.external ? 'noopener noreferrer' : undefined"
                  class="text-primary-warm-white hover:text-primary-comfy-yellow flex items-center gap-2 text-2xl font-medium"
                >
                  {{ link.label }}
                  <Badge v-if="link.badge" size="xs" variant="accent">
                    {{ t('nav.badgeNew', locale) }}
                  </Badge>
                  <ArrowUpRight
                    v-if="link.external"
                    class="text-primary-comfy-yellow size-4"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 flex-col gap-3 pt-6">
          <BrandButton
            v-for="cta in ctaButtons"
            :key="cta.href"
            :href="cta.href"
            :variant="cta.primary ? 'solid' : 'outline'"
            size="nav"
            class="w-full justify-center text-base"
          >
            {{ cta.label }}
          </BrandButton>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
