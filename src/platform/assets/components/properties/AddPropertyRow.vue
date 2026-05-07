<template>
  <ModelInfoField
    v-if="isAdding"
    :label="pendingKey ?? t('properties.addProperty')"
  >
    <template #label-action>
      <Button
        size="icon-sm"
        variant="muted-textonly"
        class="opacity-0 transition-opacity group-hover:opacity-100"
        :aria-label="t('g.cancel')"
        @click="cancelAdding"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </template>

    <!-- Step 1: key name via Combobox -->
    <ComboboxRoot
      v-if="!pendingKey"
      v-model="selectedKey"
      v-model:search-term="keyQuery"
      v-model:open="dropdownOpen"
      ignore-filter
      @update:model-value="handleKeySelected"
    >
      <ComboboxAnchor>
        <ComboboxInput
          ref="keyInputRef"
          :placeholder="t('properties.keyPlaceholder')"
          :class="
            cn(
              'flex h-10 w-full min-w-0 appearance-none rounded-lg border-none bg-secondary-background px-4 py-2 text-sm text-base-foreground',
              'placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none'
            )
          "
          @keydown.escape.stop="cancelAdding"
          @keydown.enter.stop="handleEnterKey"
          @input="
            (e: Event) => (keyQuery = (e.target as HTMLInputElement).value)
          "
        />
      </ComboboxAnchor>

      <ComboboxContent
        position="popper"
        :side-offset="4"
        :class="
          cn(
            'z-1800 max-h-60 w-(--reka-combobox-trigger-width) overflow-y-auto',
            'rounded-lg border border-border-default bg-base-background p-1 shadow-lg'
          )
        "
      >
        <ComboboxViewport>
          <ComboboxItem
            v-for="key in filteredKeys"
            :key="key"
            :value="key"
            :class="
              cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none',
                'data-highlighted:bg-secondary-background-hover'
              )
            "
          >
            <i
              :class="iconForType(suggestionTypes.get(key) ?? 'string')"
              class="size-4 text-muted-foreground"
            />
            <span>{{ key }}</span>
          </ComboboxItem>

          <ComboboxItem
            v-if="canCreate"
            :value="keyQuery"
            :class="
              cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground outline-none',
                'data-highlighted:bg-secondary-background-hover'
              )
            "
          >
            <span class="italic opacity-90">{{
              t('properties.createNew')
            }}</span>
            <span
              class="ml-1 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
            >
              {{ keyQuery }}
            </span>
          </ComboboxItem>

          <ComboboxEmpty class="px-3 py-2 text-sm text-muted-foreground">
            {{ t('properties.noSuggestions') }}
          </ComboboxEmpty>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxRoot>

    <!-- Step 2: type picker buttons -->
    <div v-else class="flex gap-2">
      <Button
        v-for="pt in propertyTypes"
        :key="pt.type"
        variant="secondary"
        size="md"
        class="flex-1 gap-1"
        @click="commitProperty(pt.type)"
      >
        <i :class="pt.icon" class="size-4" />
        {{ pt.label }}
      </Button>
    </div>
  </ModelInfoField>

  <!-- Collapsed: plain placeholder input like "Add tag..." -->
  <div v-else class="px-4 py-2">
    <input
      readonly
      :placeholder="t('properties.addProperty')"
      class="w-full cursor-pointer border-none bg-transparent text-center text-sm text-muted-foreground outline-none placeholder:text-muted-foreground"
      @click="startAdding"
      @focus="startAdding"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport
} from 'reka-ui'
import { computed, nextTick, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import ModelInfoField from '@/platform/assets/components/modelInfo/ModelInfoField.vue'
import type {
  PropertySuggestion,
  PropertyType,
  UserProperty
} from '@/platform/assets/schemas/userPropertySchema'
import {
  createDefaultProperty,
  createPropertyFromSuggestion
} from '@/platform/assets/schemas/userPropertySchema'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const props = defineProps<{
  suggestions?: Map<string, PropertySuggestion>
  existingKeys?: string[]
}>()

const suggestions = toRef(props, 'suggestions', new Map())
const existingKeys = toRef(props, 'existingKeys', [])

const emit = defineEmits<{
  add: [key: string, property: UserProperty]
}>()

const isAdding = ref(false)
const keyQuery = ref('')
const selectedKey = ref('')
const pendingKey = ref<string | null>(null)
const dropdownOpen = ref(false)
const keyInputRef = ref<HTMLElement | null>(null)

const suggestionTypes = computed(() => {
  const map = new Map<string, PropertyType>()
  for (const [key, s] of suggestions.value) map.set(key, s.type)
  return map
})

const allKeys = computed(() =>
  [...suggestions.value.keys()].filter(
    (key) => !existingKeys.value.includes(key)
  )
)

const filteredKeys = computed(() => {
  const q = keyQuery.value.toLowerCase()
  return allKeys.value.filter((key) => key.toLowerCase().includes(q))
})

const canCreate = computed(() => {
  const q = keyQuery.value.trim()
  return (
    q.length > 0 && !suggestions.value.has(q) && !existingKeys.value.includes(q)
  )
})

const propertyTypes: { type: PropertyType; icon: string; label: string }[] = [
  {
    type: 'string',
    icon: 'icon-[lucide--type]',
    label: t('properties.typeText')
  },
  {
    type: 'number',
    icon: 'icon-[lucide--hash]',
    label: t('properties.typeNumber')
  },
  {
    type: 'boolean',
    icon: 'icon-[lucide--square-check]',
    label: t('properties.typeBoolean')
  }
]

function iconForType(type: PropertyType): string {
  return (
    propertyTypes.find((pt) => pt.type === type)?.icon ?? 'icon-[lucide--type]'
  )
}

async function startAdding() {
  isAdding.value = true
  keyQuery.value = ''
  selectedKey.value = ''
  pendingKey.value = null
  dropdownOpen.value = true
  await nextTick()
  // ComboboxInput is a Vue component — access the underlying DOM via $el
  const el = keyInputRef.value as unknown as { $el?: HTMLElement } | null
  const dom = el?.$el
  const input =
    dom instanceof HTMLInputElement ? dom : dom?.querySelector?.('input')
  input?.focus()
}

function cancelAdding() {
  isAdding.value = false
  pendingKey.value = null
  keyQuery.value = ''
  selectedKey.value = ''
  dropdownOpen.value = false
}

function handleEnterKey() {
  const key = keyQuery.value.trim()
  if (!key || existingKeys.value.includes(key)) return

  const suggestion = suggestions.value.get(key)
  if (suggestion) {
    emit('add', key, createPropertyFromSuggestion(suggestion))
    cancelAdding()
  } else {
    pendingKey.value = key
  }
}

function handleKeySelected(rawValue: string) {
  const value = rawValue.trim()
  if (!value || existingKeys.value.includes(value)) return

  const suggestion = suggestions.value.get(value)
  if (suggestion) {
    emit('add', value, createPropertyFromSuggestion(suggestion))
    cancelAdding()
  } else {
    pendingKey.value = value
  }
}

function commitProperty(type: PropertyType) {
  if (!pendingKey.value) return
  emit('add', pendingKey.value, createDefaultProperty(type))
  cancelAdding()
}
</script>
