<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { ref } from 'vue'

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
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  inputId?: string
  locale?: Locale
}>()

const query = defineModel<string>({ required: true })
const providers = defineModel<string[]>('providers', { required: true })
const capabilities = defineModel<string[]>('capabilities', { required: true })

const open = ref(false)

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
</script>

<template>
  <div class="relative" @focusout="closeOnLeave">
    <label :for="inputId" class="sr-only">
      {{ t('workshop.search.label', locale) }}
    </label>
    <Search
      class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
      aria-hidden="true"
    />
    <input
      :id="inputId"
      v-model="query"
      type="search"
      :placeholder="t('workshop.search.label', locale)"
      data-testid="workshop-search"
      class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
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
      class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
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
</template>
