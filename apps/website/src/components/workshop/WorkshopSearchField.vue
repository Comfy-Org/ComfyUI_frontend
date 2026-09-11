<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, ref, useTemplateRef } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '../../config/models-catalogue'
import { filterWorkshopModels } from '../../config/models-catalogue'
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
const sheetTrigger = useTemplateRef<HTMLButtonElement>('sheetTrigger')

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

// The sheet applies as you tap, so its button is a way out that says what is
// waiting behind it.
const matches = computed(
  () =>
    filterWorkshopModels(models, {
      query: query.value,
      providers: providers.value,
      capabilities: capabilities.value
    }).length
)

function clearSheet() {
  query.value = ''
  providers.value = []
  capabilities.value = []
}

const toggled = (list: readonly string[], value: string) =>
  list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value]

// iOS zooms the page into any field it considers too small to read, which
// leaves the sheet's own controls off screen, so on a phone the text is 16px.
const fieldClass =
  'bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 max-sm:text-base [&::-webkit-search-cancel-button]:hidden'

const leadingIconClass =
  'pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray'

const clearButtonClass =
  'absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white'
</script>

<template>
  <div class="relative" @focusout="closeOnLeave">
    <button
      v-if="compact"
      ref="sheetTrigger"
      type="button"
      :aria-label="t('workshop.search.label', locale)"
      data-testid="workshop-search-button"
      :class="
        cn(
          'focus-visible:ring-brand flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl bg-white/8 px-3 text-left text-sm outline-none hover:bg-white/12 focus-visible:ring-2 sm:hidden',
          query ? 'text-primary-warm-white' : 'text-primary-warm-gray'
        )
      "
      @click="sheetOpen = true"
    >
      <Search class="size-4 shrink-0" aria-hidden="true" />
      <span class="truncate">
        {{ query || t('workshop.search.short', locale) }}
      </span>
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
        :placeholder="
          t(compact ? 'workshop.search.short' : 'workshop.search.label', locale)
        "
        :aria-label="t('workshop.search.label', locale)"
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

    <DialogRoot v-model:open="sheetOpen">
      <DialogPortal>
        <DialogContent
          class="bg-page fixed inset-0 z-50 flex flex-col sm:hidden"
          :aria-describedby="undefined"
          data-testid="workshop-search-sheet"
          @open-auto-focus.prevent="sheetInput?.focus()"
          @close-auto-focus.prevent="sheetTrigger?.focus()"
        >
          <DialogTitle class="sr-only">{{
            t('workshop.search.label', locale)
          }}</DialogTitle>
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
              :aria-label="t('workshop.search.close', locale)"
              class="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-white/8 text-primary-warm-gray hover:text-primary-warm-white"
              data-testid="workshop-search-sheet-close"
              @click="sheetOpen = false"
            >
              <X class="size-4" aria-hidden="true" />
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
            @toggle-provider="
              (value) => (providers = toggled(providers, value))
            "
            @toggle-capability="
              (value) => (capabilities = toggled(capabilities, value))
            "
          />

          <div
            class="flex items-center gap-3 border-t border-transparency-white-t8 p-3"
          >
            <button
              v-if="query || providers.length || capabilities.length"
              type="button"
              class="shrink-0 cursor-pointer px-2 text-sm text-primary-warm-gray hover:text-primary-warm-white"
              data-testid="workshop-search-sheet-clear"
              @click="clearSheet"
            >
              {{ t('workshop.filter.clearAll', locale) }}
            </button>
            <button
              type="button"
              class="bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 h-11 flex-1 cursor-pointer rounded-2xl text-sm font-bold text-primary-comfy-ink"
              data-testid="workshop-search-sheet-apply"
              @click="sheetOpen = false"
            >
              {{
                t('workshop.search.show', locale).replace('{n}', `${matches}`)
              }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
