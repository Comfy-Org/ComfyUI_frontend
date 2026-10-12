<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { Document } from '@/lib/cms/editor-document'
import type {
  InputSettingsValue,
  NumericSetting,
  OptionBuffer
} from '@/lib/cms/input-settings'
import {
  buildSettings,
  copySettings,
  numericSettings,
  optionValue,
  settingsBuffer,
  settingsMode
} from '@/lib/cms/input-settings'

const {
  schemaProperty,
  presentation,
  disabled = false,
  locale = 'en'
} = defineProps<{
  schemaProperty: Document
  presentation: Document
  disabled?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  update: [value: InputSettingsValue]
  validity: [valid: boolean]
}>()
// Adapter contract: mount each instance under its stable input-name key;
// collect validity under a distinct settings:<name> key. False validity must
// freeze alternate JSON replacement, just like existing JsonField buffers.
// Apply update through setInput rather than mutating props, and pass disabled
// during Save/upload or complete-document repair. Removing a row intentionally
// must clear its validity key. This component neither saves nor executes inputs.
const t = computed(() => translationsFor(locale).t)
const current = () => ({ property: schemaProperty, presentation })
const base = ref<InputSettingsValue>(copySettings(current()))
const buffer = ref(settingsBuffer(base.value))
const mode = computed(() => settingsMode(base.value))
const checked = computed(() => buildSettings(base.value, buffer.value))
const conflict = ref(false)
let lastEmitted: string | undefined
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg disabled:opacity-40'
const defaultIndex = computed(() =>
  buffer.value.options.findIndex((row) => {
    const value = optionValue(row)
    return (
      value !== undefined && JSON.stringify(value) === buffer.value.defaultJSON
    )
  })
)
function reload() {
  if (disabled) return
  base.value = copySettings(current())
  buffer.value = settingsBuffer(base.value)
  conflict.value = false
  lastEmitted = undefined
  emit('validity', checked.value.valid)
}
watch(
  () => JSON.stringify(current()),
  (serialized) => {
    if (serialized === lastEmitted) {
      base.value = copySettings(current())
      return
    }
    if (!checked.value.valid || conflict.value) {
      conflict.value = true
      emit('validity', false)
      return
    }
    base.value = copySettings(current())
    buffer.value = settingsBuffer(base.value)
    lastEmitted = undefined
    emit('validity', checked.value.valid)
  }
)
watch(checked, (result) => emit('validity', result.valid && !conflict.value), {
  immediate: true
})
function commit() {
  if (
    disabled ||
    conflict.value ||
    !checked.value.valid ||
    mode.value === 'unsupported'
  )
    return
  const next = copySettings(checked.value.value)
  lastEmitted = JSON.stringify(next)
  emit('update', next)
}
function numeric(key: NumericSetting, event: Event) {
  if (disabled || conflict.value || !(event.target instanceof HTMLInputElement))
    return
  buffer.value.numeric[key] = event.target.value
  commit()
}
function option(index: number, field: 'text' | 'label', event: Event) {
  if (
    disabled ||
    conflict.value ||
    !(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement
    )
  )
    return
  buffer.value.options[index][field] = event.target.value
  commit()
}
function add() {
  if (disabled || conflict.value) return
  buffer.value.options.push({
    key: crypto.randomUUID(),
    type: 'string',
    text: '',
    label: ''
  })
  commit()
}
function remove(index: number) {
  if (disabled || conflict.value) return
  buffer.value.options.splice(index, 1)
  commit()
}
function move(index: number, direction: number) {
  if (disabled || conflict.value) return
  const target = index + direction
  if (target < 0 || target >= buffer.value.options.length) return
  const rows = [...buffer.value.options]
  ;[rows[index], rows[target]] = [rows[target], rows[index]]
  buffer.value.options = rows
  commit()
}
function type(index: number, event: Event) {
  if (
    disabled ||
    conflict.value ||
    !(event.target instanceof HTMLSelectElement)
  )
    return
  const value = event.target.value
  if (!['string', 'number', 'boolean'].includes(value)) return
  // Preserve the text while changing its interpretation; validation prevents
  // incomplete numeric/boolean values from replacing the authored schema.
  const row: OptionBuffer = buffer.value.options[index]
  if (value === 'string' || value === 'number' || value === 'boolean')
    row.type = value
  commit()
}
function selectDefault(event: Event) {
  if (
    disabled ||
    conflict.value ||
    !(event.target instanceof HTMLSelectElement)
  )
    return
  if (event.target.value === '') buffer.value.defaultJSON = ''
  else {
    const row = buffer.value.options[Number(event.target.value)]
    const value = row ? optionValue(row) : undefined
    if (value === undefined) return
    buffer.value.defaultJSON = JSON.stringify(value)
  }
  commit()
}
</script>
<template>
  <section
    class="grid gap-3 rounded-lg border border-admin-line bg-admin-page p-4"
  >
    <h3 class="text-sm font-medium text-admin-fg">
      {{ t('cccInputSettings.title') }}
    </h3>
    <p v-if="mode === 'unsupported'" class="text-xs text-admin-muted">
      {{ t('cccInputSettings.unsupported') }}
    </p>
    <template v-else>
      <div
        v-if="conflict"
        role="alert"
        class="grid gap-2 text-xs text-admin-danger-text"
      >
        <p>{{ t('cccInputSettings.conflict') }}</p>
        <AdminButton :disabled @click="reload">{{
          t('cccInputSettings.reload')
        }}</AdminButton>
      </div>
      <p
        v-else-if="!checked.valid"
        role="alert"
        class="text-xs text-admin-danger-text"
      >
        {{ t(`cccInputSettings.errors.${checked.error}`) }}
      </p>
      <fieldset :disabled="disabled || conflict" class="grid min-w-0 gap-3">
        <div
          v-if="mode === 'numeric'"
          class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label
            v-for="key in numericSettings"
            :key
            class="grid gap-1 text-xs text-admin-muted"
          >
            {{ t(`cccInputSettings.${key}`) }}
            <input
              :value="buffer.numeric[key]"
              type="text"
              inputmode="decimal"
              :class="inputClass"
              @input="numeric(key, $event)"
            />
          </label>
        </div>
        <template v-else>
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-xs text-admin-muted">
              {{ t('cccInputSettings.options') }}
            </h4>
            <AdminButton :icon="Plus" @click="add">{{
              t('cccInputSettings.addOption')
            }}</AdminButton>
          </div>
          <div
            v-for="(row, index) in buffer.options"
            :key="row.key"
            class="grid gap-2 rounded-lg border border-admin-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <div class="grid gap-2">
              <label class="grid gap-1 text-xs text-admin-muted"
                >{{ t('cccInputSettings.valueType') }}
                <select
                  :value="row.type"
                  :class="inputClass"
                  @change="type(index, $event)"
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
                  @change="option(index, 'text', $event)"
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
                  @input="option(index, 'text', $event)"
                />
              </label>
            </div>
            <label class="grid content-start gap-1 text-xs text-admin-muted"
              >{{ t('cccInputSettings.optionLabel')
              }}<input
                :value="row.label"
                :class="inputClass"
                @input="option(index, 'label', $event)"
            /></label>
            <div class="flex items-end gap-1 sm:flex-col sm:justify-end">
              <AdminButton
                :icon="ArrowUp"
                :disabled="index === 0"
                :aria-label="t('cccInputSettings.moveUp')"
                @click="move(index, -1)"
              />
              <AdminButton
                :icon="ArrowDown"
                :disabled="index === buffer.options.length - 1"
                :aria-label="t('cccInputSettings.moveDown')"
                @click="move(index, 1)"
              />
              <AdminButton
                variant="dangerGhost"
                :icon="Trash2"
                :aria-label="t('cccInputSettings.removeOption')"
                @click="remove(index)"
              />
            </div>
          </div>
          <label class="grid gap-1 text-xs text-admin-muted"
            >{{ t('cccInputSettings.default') }}
            <select
              :value="
                buffer.defaultJSON === ''
                  ? ''
                  : defaultIndex < 0
                    ? 'missing'
                    : String(defaultIndex)
              "
              :class="inputClass"
              @change="selectDefault"
            >
              <option value="">{{ t('cccInputSettings.noDefault') }}</option>
              <option
                v-if="buffer.defaultJSON !== '' && defaultIndex < 0"
                value="missing"
                disabled
              >
                {{ buffer.defaultJSON }}
              </option>
              <option
                v-for="(row, index) in buffer.options"
                :key="row.key"
                :value="String(index)"
              >
                {{ row.label || row.text }}
              </option>
            </select>
          </label>
        </template>
      </fieldset>
      <p class="text-xs text-admin-muted">
        {{ t('cccInputSettings.preserve') }}
      </p>
    </template>
  </section>
</template>
