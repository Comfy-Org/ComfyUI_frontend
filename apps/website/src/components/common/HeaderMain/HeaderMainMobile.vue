<script setup lang="ts">
import BreadthumbIcon from '@/components/icons/BreadthumbIcon.vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { getMainNavigation } from '../../../data/mainNavigation'
import { getRoutes } from '../../../config/routes.ts'
import { lockScroll, unlockScroll } from '../../../composables/scrollLock'
import type { Locale } from '../../../i18n/translations.ts'
import { t } from '../../../i18n/translations.ts'
import NavLinkContent from './NavLinkContent.vue'
import NewBadge from './NewBadge.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import SheetTrigger from '@/components/ui/sheet/SheetTrigger.vue'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
const mainNavigation = getMainNavigation(locale)

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

        <div class="relative mt-4 flex-1 overflow-hidden">
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
                  <span class="ppformula-text-center">{{ item.label }}</span>
                  <NewBadge v-if="item.badge" :locale="locale" size="xxs" />
                  <template #append>
                    <ChevronRight class="size-7" />
                  </template>
                </Button>
              </li>
            </ul>
          </nav>

          <!-- Drill-down sub-panel -->
          <div
            class="absolute inset-0 bg-primary-comfy-ink transition-transform duration-300 ease-out"
            :class="
              activeItem
                ? 'translate-x-0'
                : 'pointer-events-none translate-x-full'
            "
            :inert="activeItem ? undefined : true"
            :aria-hidden="!activeItem"
          >
            <div class="size-full overflow-y-auto py-8">
              <Button
                type="button"
                variant="link"
                @click="activeSection = null"
              >
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
            <div
              class="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-primary-comfy-ink to-transparent"
            />
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-primary-comfy-ink to-transparent"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
