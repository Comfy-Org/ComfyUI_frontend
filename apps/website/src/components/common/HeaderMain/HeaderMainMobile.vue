<script setup lang="ts">
import BreadthumbIcon from '@/components/icons/BreadthumbIcon.vue'
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
        class="w-full sm:max-w-none"
        :close-label="t('nav.close', locale)"
      >
        <SheetHeader>
          <SheetTitle>Test sheet</SheetTitle>
          <SheetDescription>
            Verifies shadcn Sheet renders with the website design-system tokens.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  </div>
</template>
