<script setup lang="ts">
import BreadthumbIcon from '@/components/icons/BreadthumbIcon.vue'
import { getRoutes } from '../../../config/routes.ts'
import type { Locale } from '../../../i18n/translations.ts'
import { t } from '../../../i18n/translations.ts'
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
</script>

<template>
  <div>
    <Sheet>
      <SheetTrigger
        class="bg-primary-comfy-yellow grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-primary-comfy-ink hover:opacity-90"
      >
        <BreadthumbIcon class="h-3 w-5 text-primary-comfy-ink" />
      </SheetTrigger>
      <SheetContent
        side="right"
        class="w-full px-6 py-5 sm:max-w-none"
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
      </SheetContent>
    </Sheet>
  </div>
</template>
