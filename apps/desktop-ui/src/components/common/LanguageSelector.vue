<template>
  <Select
    :id="dropdownId"
    v-model="selectedLocale"
    :options="localeOptions"
    option-label="label"
    option-value="value"
    :disabled="isSwitching"
    :pt="dropdownPt"
    :size="props.size"
    class="language-selector"
    @change="onLocaleChange"
  >
    <template #value="{ value }">
      <span :class="valueClass">
        <i class="pi pi-language" :class="iconClass" />
        <span>{{ displayLabel(value as SupportedLocale) }}</span>
      </span>
    </template>
    <template #option="{ option }">
      <span :class="optionClass">
        <i class="pi pi-language" :class="iconClass" />
        <span class="leading-none">{{ option.label }}</span>
      </span>
    </template>
  </Select>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import type { SelectChangeEvent } from 'primevue/select'
import { computed, ref, watch } from 'vue'

import { i18n, loadLocale, st } from '@/i18n'

const props = withDefaults(
  defineProps<{
    variant?: 'dark' | 'light'
    size?: 'small' | 'large' | undefined
  }>(),
  {
    variant: 'dark',
    size: 'small'
  }
)

const dropdownId = `language-select-${Math.random().toString(36).slice(2)}`

const LOCALE_ITEMS = [
  'en',
  'zh',
  'zh-TW',
  'ru',
  'ja',
  'ko',
  'fr',
  'es',
  'ar',
  'tr'
] as const

type SupportedLocale = (typeof LOCALE_ITEMS)[number]

const selectedLocale = ref<string>(i18n.global.locale.value)
const isSwitching = ref(false)

const sizeConfig = computed(() => {
  if (props.size === 'large') {
    return {
      padding: 'px-3 py-1',
      minWidth: 'min-w-[7rem]',
      gap: 'gap-2',
      valueText: 'text-xs',
      optionText: 'text-sm',
      icon: 'text-sm'
    }
  }

  return {
    padding: 'px-2 py-0.5',
    minWidth: 'min-w-[5rem]',
    gap: 'gap-1',
    valueText: 'text-[0.6rem]',
    optionText: 'text-xs',
    icon: 'text-xs'
  }
})

const dropdownPt = computed(() => {
  if (props.variant === 'light') {
    return {
      root: {
        class: `bg-white/80 border border-neutral-200 text-neutral-700 rounded-full shadow-sm backdrop-blur ${sizeConfig.value.padding} ${sizeConfig.value.minWidth} hover:border-neutral-400 transition-colors focus-visible:ring-offset-2 focus-visible:ring-offset-white`
      },
      trigger: {
        class: 'text-neutral-500 hover:text-neutral-700'
      },
      item: {
        class:
          'text-neutral-700 text-sm bg-transparent hover:bg-neutral-100 focus-visible:outline-none'
      },
      panel: {
        class:
          'bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xl'
      },
      list: {
        class: 'py-2'
      }
    } as const
  }

  return {
    root: {
      class: `bg-neutral-900/70 border border-neutral-700 text-neutral-200 rounded-full shadow-sm backdrop-blur ${sizeConfig.value.padding} ${sizeConfig.value.minWidth} hover:border-neutral-500 transition-colors focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900`
    },
    trigger: {
      class: 'text-neutral-400 hover:text-neutral-200'
    },
    item: {
      class:
        'text-neutral-200 text-sm bg-transparent hover:bg-neutral-800/80 focus-visible:outline-none'
    },
    panel: {
      class:
        'bg-neutral-900/95 border border-neutral-700 rounded-xl overflow-hidden shadow-xl'
    },
    list: {
      class: 'py-2'
    }
  } as const
})

const valueClass = computed(() =>
  [
    'flex items-center font-medium uppercase tracking-wide leading-tight',
    sizeConfig.value.gap,
    sizeConfig.value.valueText,
    props.variant === 'light' ? 'text-neutral-600' : 'text-neutral-100'
  ].join(' ')
)

const optionClass = computed(() =>
  [
    'flex items-center leading-tight',
    sizeConfig.value.gap,
    sizeConfig.value.optionText,
    props.variant === 'light' ? 'text-neutral-600' : 'text-neutral-100'
  ].join(' ')
)

const iconClass = computed(() =>
  [
    sizeConfig.value.icon,
    props.variant === 'light' ? 'text-neutral-500' : 'text-neutral-300'
  ].join(' ')
)

const localeOptions = computed(() =>
  LOCALE_ITEMS.map((value) => ({
    value,
    label: st(
      `settings.Comfy_Locale.options.${value}`,
      formatLocaleLabel(value)
    )
  }))
)

function displayLabel(locale?: SupportedLocale) {
  if (!locale) {
    return st('settings.Comfy_Locale.name', 'Language')
  }

  const option = localeOptions.value.find((item) => item.value === locale)
  return option?.label ?? formatLocaleLabel(locale)
}

watch(
  () => i18n.global.locale.value,
  (newLocale) => {
    if (newLocale !== selectedLocale.value) {
      selectedLocale.value = newLocale
    }
  }
)

function formatLocaleLabel(locale: SupportedLocale) {
  const labels: Record<SupportedLocale, string> = {
    en: 'English',
    zh: '中文',
    'zh-TW': '繁體中文',
    ru: 'Русский',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    es: 'Español',
    ar: 'عربي',
    tr: 'Türkçe'
  }

  return labels[locale]
}

async function onLocaleChange(event: SelectChangeEvent) {
  const nextLocale = event.value as SupportedLocale | undefined

  if (!nextLocale || nextLocale === i18n.global.locale.value) {
    return
  }

  isSwitching.value = true
  try {
    await loadLocale(nextLocale)
    i18n.global.locale.value = nextLocale
  } catch (error) {
    console.error(`Failed to change locale to "${nextLocale}"`, error)
    selectedLocale.value = i18n.global.locale.value
  } finally {
    isSwitching.value = false
  }
}
</script>

<style scoped>
@reference '../../assets/css/style.css';

:deep(.p-dropdown-panel .p-dropdown-item) {
  @apply transition-colors;
}

:deep(.p-dropdown) {
  @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 focus-visible:ring-offset-2;
}
</style>
