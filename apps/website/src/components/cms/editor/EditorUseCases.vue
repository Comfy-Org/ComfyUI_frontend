<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorUseCase } from '@/lib/cms/editor'
import { EDITOR_USE_CASES } from '@/lib/cms/editor'

/** The Hub's use-case filters this page shows up under. */
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const useCases = defineModel<EditorUseCase[]>({ required: true })
const { t } = translationsFor(locale)

const labelKey = (useCase: EditorUseCase) =>
  useCase.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
function toggle(useCase: EditorUseCase) {
  useCases.value = useCases.value.includes(useCase)
    ? useCases.value.filter((chosen) => chosen !== useCase)
    : EDITOR_USE_CASES.filter(
        (option) => option === useCase || useCases.value.includes(option)
      )
}
</script>

<template>
  <fieldset class="grid gap-1.5 text-xs text-admin-muted">
    <legend class="mb-1.5">{{ t('cmsAdmin.editor.useCases.label') }}</legend>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="useCase in EDITOR_USE_CASES"
        :key="useCase"
        type="button"
        :aria-pressed="useCases.includes(useCase)"
        :class="
          cn(
            'cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-admin-control',
            useCases.includes(useCase)
              ? 'border-admin-fg bg-admin-fg text-admin-page'
              : 'border-admin-field text-admin-fg hover:bg-admin-hover'
          )
        "
        @click="toggle(useCase)"
      >
        {{ t(`workshop.useCase.${labelKey(useCase)}`) }}
      </button>
    </div>
    <span class="text-admin-subtle">{{
      t('cmsAdmin.editor.useCases.help')
    }}</span>
  </fieldset>
</template>
