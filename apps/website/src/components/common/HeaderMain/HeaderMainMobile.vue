<script setup lang="ts">
import BreadthumbIcon from '@/components/icons/BreadthumbIcon.vue'
import Button from '@/components/ui/button/Button.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import SheetTrigger from '@/components/ui/sheet/SheetTrigger.vue'
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronDown } from '@lucide/vue'
import { onUnmounted, ref, watch } from 'vue'

import { getRoutes } from '../../../config/routes.ts'
import { lockScroll, unlockScroll } from '../../../composables/scrollLock'
import { getMainNavigation } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations.ts'
import { t } from '../../../i18n/translations.ts'
import NavLinkContent from './NavLinkContent.vue'
import NewBadge from './NewBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
const mainNavigation = getMainNavigation(locale)

const isOpen = ref(false)
const activeSection = ref<string | null>(null)

function toggleSection(sectionId: string) {
  activeSection.value = activeSection.value === sectionId ? null : sectionId
}

function closeSectionAndFocus(sectionId: string) {
  activeSection.value = null
  document.getElementById(`mobile-nav-${sectionId}-trigger`)?.focus()
}

function handleSectionEscape(sectionId: string, event: KeyboardEvent) {
  if (activeSection.value !== sectionId) return
  event.stopPropagation()
  closeSectionAndFocus(sectionId)
}

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
          <nav
            class="absolute inset-0 overflow-y-auto p-1"
            :aria-label="t('nav.menu', locale)"
          >
            <ul class="flex flex-col gap-y-4">
              <li v-for="item in mainNavigation" :key="item.label">
                <template v-if="item.columns">
                  <Button
                    :id="`mobile-nav-${item.analyticsId}-trigger`"
                    type="button"
                    variant="navMuted"
                    :class="
                      cn(
                        activeSection === item.analyticsId &&
                          'text-primary-comfy-yellow'
                      )
                    "
                    :aria-expanded="activeSection === item.analyticsId"
                    :aria-controls="`mobile-nav-${item.analyticsId}-panel`"
                    :data-nav-label="item.analyticsId"
                    data-nav-placement="mobile-top"
                    @click="toggleSection(item.analyticsId)"
                    @keydown.esc="handleSectionEscape(item.analyticsId, $event)"
                  >
                    <span class="ppformula-text-center">{{ item.label }}</span>
                    <NewBadge v-if="item.badge" :locale="locale" size="xxs" />
                    <template #append>
                      <ChevronDown
                        class="size-6"
                        :class="
                          activeSection === item.analyticsId && 'rotate-180'
                        "
                        aria-hidden="true"
                      />
                    </template>
                  </Button>

                  <div
                    v-show="activeSection === item.analyticsId"
                    :id="`mobile-nav-${item.analyticsId}-panel`"
                    role="region"
                    :aria-labelledby="`mobile-nav-${item.analyticsId}-trigger`"
                    class="mt-6 flex flex-col gap-y-10 pb-4 pl-4"
                    @keydown.esc="handleSectionEscape(item.analyticsId, $event)"
                  >
                    <div
                      v-for="column in item.columns"
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
                        :data-nav-label="link.analyticsId"
                        :data-nav-placement="`mobile-${item.analyticsId}`"
                        @click="isOpen = false"
                      >
                        <NavLinkContent :item="link" :locale="locale" />
                      </Button>
                    </div>
                  </div>
                </template>
                <Button
                  v-else
                  :href="item.href"
                  variant="navMuted"
                  as="a"
                  :data-nav-label="item.analyticsId"
                  data-nav-placement="mobile-top"
                  @click="isOpen = false"
                >
                  <span class="ppformula-text-center">{{ item.label }}</span>
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
