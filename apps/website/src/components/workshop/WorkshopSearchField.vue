<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { nextTick, ref, useTemplateRef, watchEffect } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/workshop'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopSearchPanel from './WorkshopSearchPanel.vue'

// One search for the whole prototype: the same field, the same panel of
// popular models and the same provider and capability chips, wherever a
// catalogue is listed.
const {
  models,
  inputId = 'workshop-search',
  compact = false,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  inputId?: string
  /** In a crowded toolbar a phone gets a button, and the field fills the
   * screen once it is tapped. */
  compact?: boolean
  locale?: Locale
}>()

const query = defineModel<string>({ required: true })
const providers = defineModel<string[]>('providers', { required: true })
const capabilities = defineModel<string[]>('capabilities', { required: true })

const open = ref(false)
const sheetOpen = ref(false)
const sheetInput = useTemplateRef<HTMLInputElement>('sheetInput')

async function openSheet() {
  sheetOpen.value = true
  await nextTick()
  sheetInput.value?.focus()
}

// The sheet covers the page, so the catalogue behind it should not scroll
// under the finger.
watchEffect((onCleanup) => {
  if (!sheetOpen.value) return
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => (document.body.style.overflow = previous))
})

// Focus moving to the clear button or into the panel itself is still inside
// the search, so only a move out of the wrapper closes it.
function closeOnLeave(event: FocusEvent) {
  const wrapper = event.currentTarget
  const moved = event.relatedTarget
  if (
    wrapper instanceof HTMLElement &&
    (!(moved instanceof Node) || !wrapper.contains(moved))
  )
    open.value = false
}

const toggled = (list: readonly string[], value: string) =>
  list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value]

const fieldClass =
  'bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden'

const leadingIconClass =
  'pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray'

const clearButtonClass =
  'absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white'
</script>

<template>
  <div class="relative" @focusout="closeOnLeave">
    <button
      v-if="compact"
      type="button"
      :aria-label="t('workshop.search.label', locale)"
      data-testid="workshop-search-button"
      class="text-content-secondary hover:text-content focus-visible:ring-brand grid size-10 cursor-pointer place-items-center rounded-xl bg-white/8 outline-none hover:bg-white/12 focus-visible:ring-2 sm:hidden"
      @click="openSheet"
    >
      <Search class="size-4" aria-hidden="true" />
    </button>

    <div :class="cn('relative', compact && 'max-sm:hidden')">
      <label :for="inputId" class="sr-only">
        {{ t('workshop.search.label', locale) }}
      </label>
      <Search :class="leadingIconClass" aria-hidden="true" />
      <input
        :id="inputId"
        v-model="query"
        type="search"
        :placeholder="t('workshop.search.label', locale)"
        data-testid="workshop-search"
        :class="fieldClass"
        role="combobox"
        :aria-controls="`${inputId}-panel`"
        :aria-expanded="open"
        @focus="open = true"
        @keydown.escape="open = false"
      />
      <button
        v-if="query"
        type="button"
        :aria-label="t('workshop.search.clear', locale)"
        data-testid="workshop-search-clear"
        :class="clearButtonClass"
        @click="query = ''"
      >
        <X class="size-4" aria-hidden="true" />
      </button>

      <WorkshopSearchPanel
        v-if="open"
        :id="`${inputId}-panel`"
        :models
        :query
        :providers
        :capabilities
        :locale
        @pick="(model) => (query = model.name)"
        @toggle-provider="(value) => (providers = toggled(providers, value))"
        @toggle-capability="
          (value) => (capabilities = toggled(capabilities, value))
        "
      />
    </div>

    <Teleport v-if="sheetOpen" to="body">
      <div
        class="bg-page fixed inset-0 z-50 flex flex-col sm:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="t('workshop.search.label', locale)"
        data-testid="workshop-search-sheet"
      >
        <div
          class="flex items-center gap-3 border-b border-transparency-white-t8 p-3"
        >
          <div class="relative flex-1">
            <Search :class="leadingIconClass" aria-hidden="true" />
            <input
              ref="sheetInput"
              v-model="query"
              type="search"
              :placeholder="t('workshop.search.label', locale)"
              :aria-label="t('workshop.search.label', locale)"
              data-testid="workshop-search-sheet-input"
              :class="fieldClass"
              @keydown.escape="sheetOpen = false"
            />
            <button
              v-if="query"
              type="button"
              :aria-label="t('workshop.search.clear', locale)"
              :class="clearButtonClass"
              @click="query = ''"
            >
              <X class="size-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            class="shrink-0 cursor-pointer text-sm text-primary-warm-gray hover:text-primary-warm-white"
            data-testid="workshop-search-sheet-close"
            @click="sheetOpen = false"
          >
            {{ t('workshop.search.done', locale) }}
          </button>
        </div>

        <WorkshopSearchPanel
          :models
          :query
          :providers
          :capabilities
          :locale
          variant="sheet"
          @pick="
            (model) => {
              query = model.name
              sheetOpen = false
            }
          "
          @toggle-provider="(value) => (providers = toggled(providers, value))"
          @toggle-capability="
            (value) => (capabilities = toggled(capabilities, value))
          "
        />
      </div>
    </Teleport>
  </div>
</template>
