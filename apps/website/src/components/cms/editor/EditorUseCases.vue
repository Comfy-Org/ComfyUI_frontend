<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useId } from 'vue'

import { fieldClass } from '@/components/cms/ui/field'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorUseCase } from '@/lib/cms/editor'
import { EDITOR_USE_CASES } from '@/lib/cms/editor'

/** The Hub's use-case filters this page shows up under, as a multi-select. */
const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const useCases = defineModel<EditorUseCase[]>({ required: true })
const { t } = translationsFor(locale)
const id = useId()
const query = ref('')

const label = (useCase: EditorUseCase) =>
  t(
    `workshop.useCase.${useCase.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`
  )
const options = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return EDITOR_USE_CASES.filter((useCase) =>
    label(useCase).toLowerCase().includes(needle)
  )
})
const summary = computed(() => useCases.value.map(label).join(', '))

function toggle(useCase: EditorUseCase) {
  useCases.value = useCases.value.includes(useCase)
    ? useCases.value.filter((chosen) => chosen !== useCase)
    : EDITOR_USE_CASES.filter(
        (option) => option === useCase || useCases.value.includes(option)
      )
}
</script>

<template>
  <div class="grid gap-1.5 text-xs text-admin-muted">
    <span :id="`${id}-label`">{{ t('cmsAdmin.editor.useCases.label') }}</span>
    <Popover @update:open="query = ''">
      <PopoverTrigger as-child>
        <button
          type="button"
          :aria-labelledby="`${id}-label`"
          :class="
            cn(fieldClass, 'flex cursor-pointer items-center gap-2 text-left')
          "
        >
          <span
            :class="cn('flex-1 truncate', !summary && 'text-admin-subtle')"
            >{{ summary || t('cmsAdmin.editor.useCases.placeholder') }}</span
          >
          <span
            v-if="useCases.length"
            class="rounded-full bg-admin-hover px-1.5 text-xs text-admin-fg"
            >{{ useCases.length }}</span
          >
          <ChevronDown class="size-4 shrink-0 text-admin-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" class="grid gap-1 p-1.5">
        <input
          v-model="query"
          type="search"
          :aria-label="t('cmsAdmin.editor.useCases.search')"
          :placeholder="t('cmsAdmin.editor.useCases.search')"
          :class="cn(fieldClass, 'mb-1')"
        />
        <ul class="grid max-h-64 overflow-y-auto">
          <li v-for="useCase in options" :key="useCase">
            <button
              type="button"
              role="menuitemcheckbox"
              :aria-checked="useCases.includes(useCase)"
              class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-admin-hover focus-visible:bg-admin-hover focus-visible:outline-none"
              @click="toggle(useCase)"
            >
              <span
                :class="
                  cn(
                    'flex size-4 items-center justify-center rounded-sm border',
                    useCases.includes(useCase)
                      ? 'border-admin-fg bg-admin-fg text-admin-page'
                      : 'border-admin-field'
                  )
                "
              >
                <Check v-if="useCases.includes(useCase)" class="size-3" />
              </span>
              {{ label(useCase) }}
            </button>
          </li>
          <li v-if="!options.length" class="px-2 py-1.5 text-admin-subtle">
            {{ t('cmsAdmin.editor.useCases.none') }}
          </li>
        </ul>
      </PopoverContent>
    </Popover>
    <span class="text-admin-subtle">{{
      t('cmsAdmin.editor.useCases.help')
    }}</span>
  </div>
</template>
