<script setup lang="ts">
// PROTOTYPE — /learning redesign: three variants switchable via ?variant=a|b|c
// (floating bottom bar, ← / → keys also cycle). The active category filter is
// mirrored to ?category=vfx|animations|ads, standing in for the eventual
// /learning/vfx-style routes. Mounted client:only, so URL access is safe here.
import { ref, watch } from 'vue'

import type { Locale } from '../../../i18n/translations'
import type { CategoryFilter } from './prototypeData'

import PrototypeSwitcher from '../PrototypeSwitcher.vue'
import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const VARIANTS = [
  { key: 'a', name: 'Filter bar + featured lead' },
  { key: 'b', name: 'Sidebar directory' },
  { key: 'c', name: 'Spotlight + shelves' }
]

const CATEGORY_KEYS: readonly CategoryFilter[] = [
  'all',
  'vfx',
  'animations',
  'ads'
]

const readParam = <T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T => {
  const value = new URLSearchParams(window.location.search).get(key)
  return allowed.includes(value as T) ? (value as T) : fallback
}

const variant = ref(
  readParam(
    'variant',
    VARIANTS.map((v) => v.key),
    'a'
  )
)
const category = ref<CategoryFilter>(
  readParam('category', CATEGORY_KEYS, 'all')
)

const syncParam = (key: string, value: string, omitWhen?: string) => {
  const url = new URL(window.location.href)
  if (value === omitWhen) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  history.replaceState(null, '', url)
}

watch(variant, (value) => syncParam('variant', value))
watch(category, (value) => syncParam('category', value, 'all'))
</script>

<template>
  <VariantA v-if="variant === 'a'" v-model:category="category" :locale />
  <VariantB v-else-if="variant === 'b'" v-model:category="category" :locale />
  <VariantC v-else v-model:category="category" :locale />

  <PrototypeSwitcher
    :variants="VARIANTS"
    :current="variant"
    @update:current="variant = $event"
  />
</template>
