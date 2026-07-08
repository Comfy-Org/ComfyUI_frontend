<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import { brandColors } from '../../data/brandColors'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const specRows = ['hex', 'rgb', 'hsl', 'cmyk'] as const

const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const copiedHex = ref<string | null>(null)
const copiedValue = ref('')

function copyValue(hex: string, value: string) {
  copiedHex.value = hex
  copiedValue.value = value
  void copy(value)
}

function isCardCopied(hex: string) {
  return copied.value && copiedHex.value === hex
}

const liveMessage = computed(() =>
  copied.value ? `${t('brand.colors.copied', locale)} ${copiedValue.value}` : ''
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:px-20 lg:py-12">
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.colors.heading', locale) }}
      <template #subtitle>
        <p class="text-primary-warm-gray mt-4 max-w-2xl text-sm leading-[1.45]">
          {{ t('brand.colors.subheading', locale) }}
        </p>
      </template>
    </SectionHeader>

    <span class="sr-only" aria-live="polite">{{ liveMessage }}</span>

    <ul class="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-5">
      <li
        v-for="color in brandColors"
        :key="color.hex"
        :class="
          cn(
            'flex min-h-[123px] cursor-pointer flex-col rounded-[30px] p-6',
            color.swatchClass,
            color.textClass,
            color.wide && 'lg:col-span-2',
            color.border && 'border-primary-warm-gray border-[0.783px]'
          )
        "
        @click="copyValue(color.hex, color.hex)"
      >
        <div
          v-if="isCardCopied(color.hex)"
          class="flex flex-1 items-center justify-center text-center text-sm font-semibold"
          aria-hidden="true"
        >
          {{ t('brand.colors.copied', locale) }} {{ copiedValue }}
        </div>
        <template v-else>
          <span class="text-xs font-semibold">{{ color.name }}</span>
          <dl
            class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs leading-[1.4]"
          >
            <template v-for="row in specRows" :key="row">
              <dt class="uppercase opacity-50">{{ row }}</dt>
              <dd>
                <button
                  type="button"
                  :aria-label="`${t('brand.colors.copy', locale)} ${row} ${color[row]}`"
                  class="cursor-pointer text-left hover:underline"
                  @click.stop="copyValue(color.hex, color[row])"
                >
                  {{ color[row] }}
                </button>
              </dd>
            </template>
          </dl>
        </template>
      </li>
    </ul>
  </section>
</template>
