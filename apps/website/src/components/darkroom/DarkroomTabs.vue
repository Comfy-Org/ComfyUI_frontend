<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomView } from '@/lib/darkroom/vocabulary'
import { DARKROOM_VIEWS } from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { view, locale = 'en' } = defineProps<{
  view: DarkroomView
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ show: [view: DarkroomView] }>()

const tabs = DARKROOM_VIEWS.map((id) => ({
  id,
  label: t(`darkroom.tabs.${id}`)
}))
</script>

<template>
  <nav
    class="order-first flex flex-[1_1_100%] gap-1 lg:order-0 lg:flex-none"
    :aria-label="t('darkroom.tabs.label')"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      :class="
        cn(
          'h-9 cursor-pointer rounded-xl px-3 text-xs font-bold tracking-wider whitespace-nowrap text-content-muted uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white',
          view === tab.id && 'bg-transparency-white-t8 text-primary-warm-white'
        )
      "
      :aria-current="view === tab.id ? 'page' : undefined"
      :data-testid="`darkroom-tab-${tab.id}`"
      @click="emit('show', tab.id)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
