<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { settingsChips } from '@/lib/darkroom/chips'
import { downloadName } from '@/lib/darkroom/feed'
import type { DarkroomItem } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  item,
  url,
  hasPrevious,
  hasNext,
  locale = 'en'
} = defineProps<{
  item: DarkroomItem
  url?: string
  hasPrevious: boolean
  hasNext: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  close: []
  step: [direction: -1 | 1]
  copy: []
  reuse: []
  star: []
  edit: []
  vary: []
  board: [anchor: HTMLElement]
}>()

const chips = computed(() =>
  settingsChips(t, item.settings, {
    seeds: [item.settings.seed],
    seconds: item.stats.seconds,
    created: item.created,
    locale,
    notes: true
  })
)

// The viewer is modal: focus moves into it, Tab stays inside it, and focus
// goes back to where it was when the viewer closes.
const dialog = useTemplateRef<HTMLElement>('dialog')
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
let opener: Element | null = null

onMounted(() => {
  opener = document.activeElement
  closeButton.value?.focus()
})
onBeforeUnmount(() => {
  if (opener instanceof HTMLElement) opener.focus()
})

function keepFocusInside(event: KeyboardEvent) {
  const stops = [
    ...(dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href]'
    ) ?? [])
  ]
  const first = stops.at(0)
  const last = stops.at(-1)
  const leaving = event.shiftKey ? first : last
  if (document.activeElement !== leaving) return
  event.preventDefault()
  const wrapTo = event.shiftKey ? last : first
  wrapTo?.focus()
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Tab') keepFocusInside(event)
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowRight' && hasNext) emit('step', 1)
  if (event.key === 'ArrowLeft' && hasPrevious) emit('step', -1)
})

function board(event: Event) {
  if (event.currentTarget instanceof HTMLElement)
    emit('board', event.currentTarget)
}

const action =
  'cursor-pointer rounded-xl border border-transparency-white-t20 px-3 py-2 text-xs font-bold tracking-wider text-primary-warm-white uppercase no-underline transition-colors hover:border-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
const nav =
  'absolute bottom-2 size-11 cursor-pointer rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink/80 text-xl text-primary-warm-white hover:bg-primary-warm-white hover:text-primary-comfy-ink disabled:cursor-default disabled:opacity-25 disabled:hover:bg-primary-comfy-ink/80 disabled:hover:text-primary-warm-white md:top-1/2 md:bottom-auto md:-translate-y-1/2'
</script>

<template>
  <div
    ref="dialog"
    role="dialog"
    aria-modal="true"
    :aria-label="t('darkroom.lightbox.label')"
    class="fixed inset-0 z-60 flex flex-col bg-primary-comfy-ink/95"
    data-testid="darkroom-lightbox"
  >
    <div
      class="relative flex min-h-0 flex-1 items-center justify-center px-2 pt-4 pb-2 md:px-18 md:pt-5"
      @click.self="emit('close')"
    >
      <button
        type="button"
        :class="cn(nav, 'left-4')"
        :disabled="!hasPrevious"
        :aria-label="t('darkroom.lightbox.previous')"
        @click="emit('step', -1)"
      >
        ‹
      </button>
      <img
        v-if="url"
        :src="url"
        :alt="item.settings.prompt"
        class="max-h-full max-w-full rounded-2xl"
      />
      <button
        type="button"
        :class="cn(nav, 'right-4')"
        :disabled="!hasNext"
        :aria-label="t('darkroom.lightbox.next')"
        @click="emit('step', 1)"
      >
        ›
      </button>
    </div>
    <div
      class="flex flex-wrap items-center justify-between gap-4 px-4 pt-3 pb-5 lg:px-6"
    >
      <div class="max-w-240 min-w-0 flex-[1_1_30rem]">
        <p class="line-clamp-2 text-base text-content">
          {{ item.settings.prompt }}
        </p>
        <ul class="mt-2 flex flex-wrap gap-1.5">
          <li
            v-for="chip in chips"
            :key="chip"
            class="rounded-lg bg-transparency-white-t8 px-2 py-0.5 text-sm text-content"
          >
            {{ chip }}
          </li>
          <li
            v-if="item.cloudAssetId"
            class="rounded-lg bg-transparency-white-t8 px-2 py-0.5 text-sm text-content"
          >
            {{ t('darkroom.lightbox.savedToCloud') }}
          </li>
        </ul>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          :class="action"
          :title="t('darkroom.lightbox.copyTitle')"
          @click="emit('copy')"
        >
          {{ t('darkroom.lightbox.copy') }}
        </button>
        <button
          type="button"
          :class="action"
          :title="t('darkroom.row.reuseTitle')"
          @click="emit('reuse')"
        >
          {{ t('darkroom.row.reuse') }}
        </button>
        <button
          type="button"
          :class="
            cn(
              action,
              item.starred &&
                'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
            )
          "
          :aria-pressed="!!item.starred"
          @click="emit('star')"
        >
          {{
            item.starred
              ? t('darkroom.lightbox.starred')
              : t('darkroom.tile.star')
          }}
        </button>
        <button
          type="button"
          :class="action"
          :title="t('darkroom.tile.editTitle')"
          @click="emit('edit')"
        >
          {{ t('darkroom.tile.edit') }}
        </button>
        <button
          type="button"
          :class="action"
          :title="t('darkroom.tile.variationsTitle')"
          @click="emit('vary')"
        >
          {{ t('darkroom.tile.variations') }}
        </button>
        <button
          type="button"
          :class="action"
          data-darkroom-menu-anchor
          @click="board"
        >
          {{ t('darkroom.tile.board') }}
        </button>
        <a
          v-if="url"
          :href="url"
          :download="downloadName(item)"
          :class="action"
        >
          {{ t('darkroom.tile.download') }}
        </a>
        <button
          ref="closeButton"
          type="button"
          :class="action"
          @click="emit('close')"
        >
          {{ t('darkroom.lightbox.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
