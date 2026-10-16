<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

// Mar's searchable multi-select adapted to editorial strings. Generation types
// are not an editorial taxonomy and must never replace the authored values.
const {
  modelValue,
  disabled = false,
  locale = 'en'
} = defineProps<{
  modelValue: string[]
  disabled?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { t } = translationsFor(locale)
const id = useId()
const open = ref(false)
const query = ref('')
const options = computed(() =>
  modelValue.filter((item) =>
    item.toLowerCase().includes(query.value.trim().toLowerCase())
  )
)
const newValue = computed(() => {
  const value = query.value.trim()
  return value &&
    [...value].length <= 100 &&
    modelValue.length < 100 &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    !modelValue.some(
      (item) => item.trim().toLowerCase() === value.toLowerCase()
    )
    ? value
    : undefined
})
function add() {
  if (!disabled && newValue.value) {
    emit('update:modelValue', [...modelValue, newValue.value])
    query.value = ''
  }
}
function remove(value: string) {
  if (!disabled)
    emit(
      'update:modelValue',
      modelValue.filter((item) => item !== value)
    )
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    add()
  }
}
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 gap-1.5 text-xs text-admin-muted">
    <span :id="`${id}-label`">{{ t('cmsEditor.useCases') }}</span>
    <PopoverRoot v-model:open="open" @update:open="query = ''">
      <PopoverTrigger as-child>
        <button
          type="button"
          :disabled
          :aria-labelledby="`${id}-label`"
          class="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-left text-sm text-admin-fg disabled:opacity-50"
        >
          <span class="min-w-0 flex-1 truncate">{{
            modelValue.join(', ') || t('cccEditorLayout.solutionsPlaceholder')
          }}</span>
          <span
            v-if="modelValue.length"
            class="rounded-full bg-admin-hover px-1.5 text-xs"
            >{{ modelValue.length }}</span
          >
          <ChevronDown class="size-4 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          align="start"
          :side-offset="4"
          class="z-50 grid w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-xl border border-admin-line bg-admin-card p-2 font-admin text-sm text-admin-fg shadow-admin-popover"
        >
          <input
            v-model="query"
            type="search"
            :disabled
            :aria-label="t('cccEditorLayout.solutionsSearch')"
            :placeholder="t('cccEditorLayout.solutionsSearch')"
            class="w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 outline-none focus:border-primary-comfy-yellow"
            @keydown="keyboard"
          />
          <div class="grid max-h-64 gap-1 overflow-y-auto">
            <button
              v-for="option in options"
              :key="option"
              type="button"
              :disabled
              class="flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-admin-hover disabled:opacity-50"
              :aria-label="
                t('cccEditorLayout.removeSolution', { name: option })
              "
              @click="remove(option)"
            >
              <Check class="size-4 shrink-0" aria-hidden="true" /><span
                class="break-all"
                >{{ option }}</span
              >
            </button>
            <button
              v-if="newValue"
              type="button"
              :disabled
              class="rounded-lg bg-admin-hover px-2 py-2 text-left disabled:opacity-50"
              @click="add"
            >
              {{ t('cccEditorLayout.addSolution', { name: newValue }) }}
            </button>
          </div>
          <p class="p-1 text-xs text-admin-muted">
            {{ t('cccEditorLayout.solutionsHelp') }}
          </p>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
