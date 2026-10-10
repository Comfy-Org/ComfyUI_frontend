<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import CinematicGateButton from '@/components/workshop/cinematic-studio/CinematicGateButton.vue'
import type { DarkroomReference } from '@/lib/darkroom/feed'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  gate,
  references,
  history,
  boardName,
  summary,
  settingsOpen,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  references: readonly DarkroomReference[]
  /** Earlier prompts, newest first, for ↑ and ↓. */
  history: readonly string[]
  /** The moodboard new images follow, if one is picked. */
  boardName?: string
  /** The model, shape and image count, shown on the settings button. */
  summary: string
  settingsOpen: boolean
  locale?: Locale
}>()
const prompt = defineModel<string>({ required: true })
const { t } = translationsFor(locale)

const emit = defineEmits<{
  generate: []
  files: [files: File[]]
  removeReference: [index: number]
  clearReferences: []
  toggleSettings: []
  moodboard: [anchor: HTMLElement]
}>()

const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
const file = useTemplateRef<HTMLInputElement>('file')
let historyAt = -1

function resize() {
  const element = textarea.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`
}
watch(prompt, () => void nextTick(resize))

function focus() {
  textarea.value?.focus()
}
defineExpose({ focus })

function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('generate')
    return
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  // ↑ and ↓ step through earlier prompts, but leave what is being typed alone.
  const browsing = historyAt >= 0 && prompt.value === history[historyAt]
  if (prompt.value && !browsing) return
  event.preventDefault()
  const next =
    event.key === 'ArrowUp'
      ? browsing
        ? historyAt + 1
        : 0
      : browsing
        ? historyAt - 1
        : -1
  if (next >= history.length) return
  historyAt = next
  prompt.value = next < 0 ? '' : history[next]
}

function picked(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  emit('files', [...(input.files ?? [])])
  input.value = ''
}

function moodboard(event: Event) {
  if (event.currentTarget instanceof HTMLElement)
    emit('moodboard', event.currentTarget)
}

defineSlots<{ tabs(): unknown }>()

const iconButton =
  'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold tracking-wider whitespace-nowrap text-content uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white'
</script>

<template>
  <div
    class="sticky top-0 z-10 border-b border-transparency-white-t8 bg-primary-comfy-ink px-4 pt-4 pb-3 lg:px-6"
  >
    <div
      class="mx-auto flex w-full max-w-10xl flex-wrap items-center gap-3 lg:flex-nowrap"
    >
      <h1
        class="hidden font-formula-narrow text-xl font-semibold tracking-tight whitespace-nowrap text-primary-warm-white uppercase lg:block"
      >
        {{ t('darkroom.title') }}
      </h1>
      <slot name="tabs" />
      <div
        class="flex min-w-0 flex-[1_1_100%] items-center gap-1.5 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light py-1.5 pr-1.5 pl-4 focus-within:border-primary-comfy-canvas lg:flex-1"
      >
        <textarea
          ref="textarea"
          v-model="prompt"
          rows="1"
          class="h-9 max-h-40 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base/snug text-primary-warm-white outline-none placeholder:text-content-muted"
          :placeholder="
            history.length
              ? t('darkroom.prompt.placeholderHistory')
              : t('darkroom.prompt.placeholder')
          "
          :aria-label="t('darkroom.prompt.label')"
          data-testid="darkroom-prompt"
          @keydown="keydown"
        />
        <button
          type="button"
          :class="iconButton"
          :title="t('darkroom.prompt.referencesTitle')"
          :aria-label="t('darkroom.prompt.references')"
          @click="file?.click()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
            class="size-4.5 shrink-0"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="M21 16l-5-5-9 9" />
          </svg>
          <span
            v-if="references.length"
            class="rounded-lg bg-primary-warm-white px-1.5 text-xs/5 text-primary-comfy-ink"
          >
            {{ references.length }}
          </span>
        </button>
        <button
          type="button"
          :class="
            cn(
              iconButton,
              boardName && 'bg-transparency-white-t8 text-primary-warm-white'
            )
          "
          :title="
            boardName
              ? t('darkroom.prompt.moodboardActive', { name: boardName })
              : t('darkroom.prompt.moodboardTitle')
          "
          :aria-label="t('darkroom.prompt.moodboard')"
          data-darkroom-menu-anchor
          data-testid="darkroom-moodboard-button"
          @click="moodboard"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
            class="size-4.5 shrink-0"
          >
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
          </svg>
          <span v-if="boardName" class="hidden max-w-48 truncate md:inline">
            {{ boardName }}
          </span>
        </button>
        <button
          type="button"
          :class="
            cn(
              iconButton,
              settingsOpen && 'bg-transparency-white-t8 text-primary-warm-white'
            )
          "
          :title="t('darkroom.prompt.settings')"
          :aria-expanded="settingsOpen"
          aria-controls="darkroom-settings"
          data-testid="darkroom-settings-toggle"
          @click="emit('toggleSettings')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
            class="size-4.5 shrink-0"
          >
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
          <span class="hidden 2xl:inline">{{ summary }}</span>
        </button>
      </div>
      <div class="flex flex-[1_1_100%] flex-col lg:flex-none">
        <CinematicGateButton
          :gate
          :rendering="false"
          :can-generate="true"
          :tooltip="false"
          wide
          :locale
          @generate="emit('generate')"
        />
      </div>
    </div>
    <input
      ref="file"
      type="file"
      accept="image/*"
      multiple
      hidden
      @change="picked"
    />
    <div
      v-if="references.length"
      class="mx-auto mt-2.5 flex w-full max-w-10xl flex-wrap items-center gap-2.5"
      data-testid="darkroom-references"
    >
      <span
        class="text-xs font-bold tracking-wider text-content-muted uppercase"
      >
        {{ t('darkroom.refs.label') }}
      </span>
      <div
        v-for="(reference, index) in references"
        :key="index"
        class="relative size-14 overflow-hidden rounded-xl bg-site-bg-soft"
        :title="reference.name"
      >
        <img
          :src="reference.url"
          :alt="t('darkroom.refs.alt', { n: index + 1 })"
          class="block size-full object-cover"
        />
        <span
          class="absolute bottom-1 left-1 h-4.5 min-w-4.5 rounded-md bg-primary-comfy-ink/80 px-1 text-center text-xs/4.5 font-bold text-primary-warm-white"
        >
          {{ index + 1 }}
        </span>
        <button
          type="button"
          class="absolute top-0.5 right-0.5 size-5 cursor-pointer rounded-full bg-black/70 text-sm/5 text-white"
          :aria-label="t('darkroom.refs.remove', { n: index + 1 })"
          @click="emit('removeReference', index)"
        >
          ×
        </button>
      </div>
      <span class="text-sm text-content-muted">
        {{
          references.length > 1
            ? t('darkroom.refs.hintMany')
            : t('darkroom.refs.hintOne')
        }}
      </span>
      <button
        type="button"
        class="cursor-pointer px-1 py-1.5 text-xs font-bold tracking-wider text-content-muted uppercase hover:text-primary-warm-white"
        @click="emit('clearReferences')"
      >
        {{ t('darkroom.refs.removeAll') }}
      </button>
    </div>
  </div>
</template>
