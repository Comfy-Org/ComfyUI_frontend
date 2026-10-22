<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Trash2 } from '@lucide/vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { OptionBuffer } from '@/lib/cms/input-settings'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { row, index, last, inputClass, locale } = defineProps<{
  row: OptionBuffer
  index: number
  last: boolean
  inputClass: string
  locale: Locale
}>()
const emit = defineEmits<{
  type: [event: Event]
  option: [field: 'text' | 'label', event: Event]
  move: [direction: number]
  remove: []
}>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <div
    class="grid gap-2 rounded-lg border border-admin-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
  >
    <div class="grid gap-2">
      <label class="grid gap-1 text-xs text-admin-muted"
        >{{ t('cccInputSettings.valueType') }}
        <select
          :value="row.type"
          :class="inputClass"
          @change="emit('type', $event)"
        >
          <option value="string">
            {{ t('cccInputSettings.string') }}
          </option>
          <option value="number">
            {{ t('cccInputSettings.number') }}
          </option>
          <option value="boolean">
            {{ t('cccInputSettings.boolean') }}
          </option>
        </select>
      </label>
      <label class="grid gap-1 text-xs text-admin-muted"
        >{{ t('cccInputSettings.optionValue') }}
        <select
          v-if="row.type === 'boolean'"
          :value="row.text"
          :class="inputClass"
          @change="emit('option', 'text', $event)"
        >
          <option
            v-if="!['true', 'false'].includes(row.text)"
            :value="row.text"
          >
            {{ row.text }}
          </option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <input
          v-else
          :value="row.text"
          :inputmode="row.type === 'number' ? 'decimal' : undefined"
          :class="inputClass"
          @input="emit('option', 'text', $event)"
        />
      </label>
    </div>
    <label class="grid content-start gap-1 text-xs text-admin-muted"
      >{{ t('cccInputSettings.optionLabel')
      }}<input
        :value="row.label"
        :class="inputClass"
        @input="emit('option', 'label', $event)"
    /></label>
    <div class="flex items-end gap-1 sm:flex-col sm:justify-end">
      <AdminButton
        :icon="ArrowUp"
        :disabled="index === 0"
        :aria-label="t('cccInputSettings.moveUp')"
        @click="emit('move', -1)"
      />
      <AdminButton
        :icon="ArrowDown"
        :disabled="last"
        :aria-label="t('cccInputSettings.moveDown')"
        @click="emit('move', 1)"
      />
      <AdminButton
        variant="dangerGhost"
        :icon="Trash2"
        :aria-label="t('cccInputSettings.removeOption')"
        @click="emit('remove')"
      />
    </div>
  </div>
</template>
