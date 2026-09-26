<script setup lang="ts">
import { X } from '@lucide/vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { onMounted, useTemplateRef } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { title, locale = 'en' } = defineProps<{
  title: string
  locale?: Locale
}>()

const emit = defineEmits<{ close: [] }>()

const root = useTemplateRef<HTMLElement>('root')
onKeyStroke('Escape', () => emit('close'), { target: root })
onClickOutside(root, () => emit('close'), {
  ignore: ['[aria-haspopup="dialog"]', '[role="menu"]']
})
onMounted(() => {
  const target =
    root.value?.querySelector<HTMLElement>('[aria-checked="true"]') ??
    root.value?.querySelector<HTMLElement>(
      '[data-popover-body] :is(button, input)'
    )
  target?.focus({ preventScroll: true })
})
</script>

<template>
  <section
    ref="root"
    role="dialog"
    :aria-label="title"
    class="flex flex-col overflow-y-auto overscroll-contain rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light p-3 shadow-[0_24px_64px_rgb(0_0_0/0.5)]"
    data-testid="cinematic-picker"
  >
    <header
      class="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex items-center justify-between border-b border-transparency-white-t8 bg-primary-comfy-ink-light px-4 py-3 lg:hidden"
    >
      <h2 class="text-sm font-semibold text-primary-warm-white">
        {{ title }}
      </h2>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-lg text-primary-comfy-canvas hover:bg-transparency-white-t8"
        :aria-label="tc('cinematic.picker.close', locale)"
        @click="emit('close')"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </header>
    <div class="contents" data-popover-body>
      <slot />
    </div>
  </section>
</template>
