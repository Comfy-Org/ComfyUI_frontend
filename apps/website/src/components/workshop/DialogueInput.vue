<script setup lang="ts">
import { computed } from 'vue'

import { workshopDialogueTurns } from '../../config/workshop-dialogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  name,
  label,
  disabled = false,
  locale = 'en',
  describedBy
} = defineProps<{
  name: string
  label: string
  disabled?: boolean
  locale?: Locale
  describedBy?: string
}>()
const value = defineModel<string>({ required: true })
const turns = computed(
  () => workshopDialogueTurns(value.value) ?? [{ text: '', voice_id: '' }]
)
const inputClass =
  'w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 py-3 text-sm text-primary-warm-white outline-none focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-50'

function edit(index: number, key: 'text' | 'voice_id', event: Event) {
  if (
    !(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
  )
    return
  const text = event.target.value
  value.value = JSON.stringify(
    turns.value.map((turn, position) =>
      position === index ? { ...turn, [key]: text } : turn
    )
  )
}

function add() {
  value.value = JSON.stringify([...turns.value, { text: '', voice_id: '' }])
}

function remove(index: number) {
  value.value = JSON.stringify(
    turns.value.filter((_, position) => position !== index)
  )
}
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    :aria-describedby="describedBy"
    class="flex flex-col gap-4"
  >
    <fieldset
      v-for="(turn, index) in turns"
      :key="index"
      :disabled
      class="flex min-w-0 flex-col gap-2 rounded-2xl border border-transparency-white-t20 p-4"
    >
      <legend class="px-1 text-xs font-bold text-primary-warm-white">
        {{
          t('workshop.dialogue.turn', locale).replace(
            '{number}',
            String(index + 1)
          )
        }}
      </legend>
      <label
        :for="`${name}-${index}-text`"
        class="text-xs text-primary-warm-gray"
        >{{ t('workshop.dialogue.text', locale) }}</label
      >
      <textarea
        :id="`${name}-${index}-text`"
        :value="turn.text"
        :class="inputClass"
        rows="3"
        aria-required="true"
        @input="edit(index, 'text', $event)"
      />
      <label
        :for="`${name}-${index}-voice`"
        class="text-xs text-primary-warm-gray"
        >{{ t('workshop.dialogue.voice', locale) }}</label
      >
      <input
        :id="`${name}-${index}-voice`"
        :value="turn.voice_id"
        :class="inputClass"
        type="text"
        aria-required="true"
        @input="edit(index, 'voice_id', $event)"
      />
      <button
        v-if="turns.length > 1"
        type="button"
        class="focus-visible:outline-primary-comfy-yellow self-start rounded-lg px-2 py-1 text-xs text-primary-warm-white underline"
        @click="remove(index)"
      >
        {{ t('workshop.dialogue.remove', locale) }}
      </button>
    </fieldset>
    <button
      type="button"
      :disabled
      class="focus-visible:outline-primary-comfy-yellow self-start rounded-lg border border-transparency-white-t20 px-4 py-2 text-sm text-primary-warm-white disabled:opacity-50"
      @click="add"
    >
      {{ t('workshop.dialogue.add', locale) }}
    </button>
  </div>
</template>
