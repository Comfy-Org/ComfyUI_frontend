<script setup lang="ts">
import { onClickOutside, useEventListener } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DarkroomBoard } from '@/lib/darkroom/store'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  anchor,
  mode,
  boards,
  itemsOf,
  covers,
  activeId,
  locale = 'en'
} = defineProps<{
  anchor: HTMLElement
  /** `add` picks a board to add images to; `use` picks the one to follow. */
  mode: 'add' | 'use'
  boards: readonly DarkroomBoard[]
  /** A board's images that still exist. */
  itemsOf: (board: DarkroomBoard) => string[]
  /** Board id to the address of its first image. */
  covers: ReadonlyMap<string, string>
  activeId?: string | null
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  pick: [id: string | undefined, newName?: string]
  manage: []
  close: []
}>()

const menu = useTemplateRef<HTMLElement>('menu')
const position = ref({ left: '0px', top: '0px' })
const newName = ref('')

// In `use` mode only boards with images can steer a generation.
const shown = computed(() =>
  boards
    .map((board) => ({ board, count: itemsOf(board).length }))
    .filter((entry) => mode === 'add' || entry.count > 0)
)

onMounted(async () => {
  await nextTick()
  const element = menu.value
  if (!element) return
  const rect = anchor.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = element
  let top = rect.bottom + 6
  if (top + height > window.innerHeight - 8)
    top = Math.max(8, rect.top - height - 6)
  position.value = {
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
    top: `${top}px`
  }
  if (mode === 'add' && !boards.length) element.querySelector('input')?.focus()
})

onClickOutside(menu, () => emit('close'), { ignore: [anchor] })
useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
})
useEventListener('scroll', () => emit('close'), { passive: true })

function create() {
  const name = newName.value.trim()
  if (name) emit('pick', undefined, name)
}

const row =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-content hover:bg-transparency-white-t8 hover:text-primary-warm-white'
</script>

<template>
  <div
    ref="menu"
    role="menu"
    class="fixed z-70 max-h-[60vh] max-w-84 min-w-64 overflow-auto rounded-2xl border border-transparency-white-t8 bg-site-dropdown p-1.5 shadow-lg"
    :style="position"
    data-testid="darkroom-board-menu"
  >
    <div
      class="px-2.5 pt-2 pb-1 text-xs font-bold tracking-wider text-content-muted uppercase"
    >
      {{
        mode === 'add'
          ? t('darkroom.boards.menuAdd')
          : t('darkroom.boards.menuUse')
      }}
    </div>
    <button
      v-if="mode === 'use'"
      type="button"
      role="menuitem"
      :class="
        cn(row, !activeId && 'bg-transparency-white-t8 text-primary-warm-white')
      "
      @click="emit('pick', undefined)"
    >
      <span
        class="size-8 shrink-0 rounded-md border border-dashed border-transparency-white-t20 bg-site-bg-soft"
      />
      <span class="truncate">{{ t('darkroom.boards.none') }}</span>
    </button>
    <button
      v-for="{ board, count } in shown"
      :key="board.id"
      type="button"
      role="menuitem"
      :class="
        cn(
          row,
          mode === 'use' &&
            board.id === activeId &&
            'bg-transparency-white-t8 text-primary-warm-white'
        )
      "
      @click="emit('pick', board.id)"
    >
      <img
        v-if="covers.get(board.id)"
        :src="covers.get(board.id)"
        alt=""
        class="size-8 shrink-0 rounded-md object-cover"
      />
      <span
        v-else
        class="size-8 shrink-0 rounded-md border border-dashed border-transparency-white-t20 bg-site-bg-soft"
      />
      <span class="truncate">{{ board.name }}</span>
      <span class="ml-auto text-sm text-content-muted">{{ count }}</span>
    </button>
    <div
      v-if="mode === 'use' || boards.length"
      class="mx-1 my-1.5 h-px bg-transparency-white-t8"
    />
    <button
      v-if="mode === 'use'"
      type="button"
      role="menuitem"
      :class="row"
      @click="emit('manage')"
    >
      {{
        boards.length
          ? t('darkroom.boards.manage')
          : t('darkroom.boards.makeOne')
      }}
    </button>
    <input
      v-else
      v-model="newName"
      type="text"
      maxlength="80"
      class="mt-0.5 h-10 w-full rounded-xl border border-transparency-white-t20 bg-site-bg-soft px-3 text-base text-primary-warm-white outline-none placeholder:text-content-muted focus:border-primary-comfy-canvas"
      :placeholder="t('darkroom.boards.newPlaceholder')"
      :aria-label="t('darkroom.boards.newLabel')"
      @keydown.enter="create"
    />
  </div>
</template>
