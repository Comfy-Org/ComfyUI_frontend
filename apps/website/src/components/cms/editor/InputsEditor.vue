<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import JsonField from './JsonField.vue'
import InputSettings from './InputSettings.vue'
import type { Document } from '@/lib/cms/editor-document'
import { objectValue, removeInput, setInput } from '@/lib/cms/editor-document'
import { workshopInputDefinitionSchema } from '@/config/workshop-input-definition'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const document = defineModel<Document>({ required: true })
const { locale = 'en', disabled = false } = defineProps<{
  locale?: Locale
  disabled?: boolean
}>()
const emit = defineEmits<{ validity: [key: string, valid: boolean] }>()
const t = translationsFor(locale).t
const newName = ref('')
const error = ref(false)
const invalid = ref(new Set<string>())
function validity(key: string, valid: boolean) {
  if (valid) invalid.value.delete(key)
  else invalid.value.add(key)
  emit('validity', key, valid)
}
function rowBlocked(name: string) {
  return (
    disabled ||
    ['input', 'schema', 'settings'].some((kind) =>
      invalid.value.has(`${kind}:${name}`)
    )
  )
}
const controls = workshopInputDefinitionSchema.shape.control.options
const entries = computed(() =>
  Object.entries(objectValue(document.value.inputs))
)
const schema = computed(() => objectValue(document.value.inputSchema))
const properties = computed(() => objectValue(schema.value.properties))
function required(name: string) {
  return (
    Array.isArray(schema.value.required) && schema.value.required.includes(name)
  )
}
function text(value: Document[string] | undefined) {
  return typeof value === 'string' ? value : ''
}
function update(
  name: string,
  definition: Document,
  property: Document,
  isRequired: boolean
) {
  if (disabled) return
  const next = setInput(document.value, name, definition, property, isRequired)
  error.value = !next
  validity(`definition:${name}`, Boolean(next))
  if (next) document.value = next
}
function patch(name: string, field: string, event: Event) {
  if (rowBlocked(name)) return
  const target = event.target
  if (
    !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
  )
    return
  const value =
    target instanceof HTMLInputElement && target.type === 'checkbox'
      ? target.checked
      : target.value
  update(
    name,
    {
      ...objectValue(objectValue(document.value.inputs)[name]),
      [field]: value
    },
    objectValue(properties.value[name]),
    required(name)
  )
}
function add() {
  if (disabled) return
  const name = newName.value.trim()
  if (
    !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ||
    ['__proto__', 'prototype', 'constructor'].includes(name) ||
    Object.hasOwn(objectValue(document.value.inputs), name)
  ) {
    error.value = true
    return
  }
  update(
    name,
    {
      label: name,
      help: '',
      hidden: false,
      advanced: false,
      control: 'text-box'
    },
    { type: 'string' },
    false
  )
  if (!error.value) newName.value = ''
}
function remove(name: string) {
  if (disabled) return
  document.value = removeInput(document.value, name)
  for (const kind of ['input', 'schema', 'definition', 'settings'])
    validity(`${kind}:${name}`, true)
}
function toggleRequired(name: string, raw: Document) {
  if (!rowBlocked(name))
    update(name, raw, objectValue(properties.value[name]), !required(name))
}
function updateBindings(value: Document) {
  if (!disabled) document.value = { ...document.value, inputBindings: value }
}
</script>
<template>
  <section
    class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-medium">{{ t('cmsEditor.inputs') }}</h2>
        <p class="text-sm text-admin-muted">{{ t('cmsEditor.inputsHelp') }}</p>
      </div>
      <div class="flex items-end gap-2">
        <label class="grid gap-1 text-xs text-admin-muted"
          >{{ t('cmsEditor.parameterName')
          }}<input
            v-model="newName"
            :disabled
            class="h-8 w-40 rounded-lg border border-admin-field bg-admin-page px-2 text-admin-fg"
            @keydown.enter.prevent="add"
        /></label>
        <AdminButton :icon="Plus" :disabled @click="add">{{
          t('cmsEditor.addInput')
        }}</AdminButton>
      </div>
    </div>
    <p v-if="error" role="alert" class="text-sm text-admin-danger-text">
      {{ t('cmsEditor.invalidInput') }}
    </p>
    <p v-if="!entries.length" class="py-4 text-sm text-admin-muted">
      {{ t('cmsEditor.noInputs') }}
    </p>
    <div
      v-for="[name, raw] in entries"
      :key="name"
      class="grid gap-3 rounded-lg border border-admin-line p-4"
    >
      <div class="flex items-center justify-between">
        <code class="text-sm">{{ name }}</code
        ><AdminButton
          :icon="Trash2"
          variant="dangerGhost"
          :disabled
          :aria-label="t('cmsEditor.removeInput', { name })"
          @click="remove(name)"
        />
      </div>
      <fieldset :disabled="rowBlocked(name)" class="grid min-w-0 gap-3">
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="grid gap-1 text-xs text-admin-muted"
            >{{ t('cmsEditor.label')
            }}<input
              :value="text(objectValue(raw).label)"
              class="rounded-lg border border-admin-field bg-admin-page p-2 text-admin-fg"
              @input="patch(name, 'label', $event)"
          /></label>
          <label class="grid gap-1 text-xs text-admin-muted"
            >{{ t('cmsEditor.control')
            }}<select
              :value="text(objectValue(raw).control)"
              class="rounded-lg border border-admin-field bg-admin-page p-2 text-admin-fg"
              @change="patch(name, 'control', $event)"
            >
              <option
                v-for="control in controls"
                :key="control"
                :value="control"
              >
                {{ control }}
              </option>
            </select></label
          >
          <label class="grid gap-1 text-xs text-admin-muted"
            >{{ t('cmsEditor.help')
            }}<input
              :value="text(objectValue(raw).help)"
              maxlength="140"
              class="rounded-lg border border-admin-field bg-admin-page p-2 text-admin-fg"
              @input="patch(name, 'help', $event)"
          /></label>
        </div>
        <div class="flex flex-wrap gap-5 text-sm text-admin-muted">
          <label
            ><input
              type="checkbox"
              :checked="required(name)"
              @change="toggleRequired(name, objectValue(raw))"
            />
            {{ t('cmsEditor.required') }}</label
          >
          <label
            ><input
              type="checkbox"
              :checked="objectValue(raw).advanced === true"
              @change="patch(name, 'advanced', $event)"
            />
            {{ t('cmsEditor.advanced') }}</label
          >
          <label
            ><input
              type="checkbox"
              :checked="objectValue(raw).hidden === true"
              @change="patch(name, 'hidden', $event)"
            />
            {{ t('cmsEditor.hidden') }}</label
          >
        </div>
      </fieldset>
      <InputSettings
        :schema-property="objectValue(properties[name])"
        :presentation="objectValue(raw)"
        :disabled="
          disabled ||
          invalid.has(`schema:${name}`) ||
          invalid.has(`input:${name}`)
        "
        :locale
        @validity="validity(`settings:${name}`, $event)"
        @update="
          update(name, $event.presentation, $event.property, required(name))
        "
      />
      <details>
        <summary class="cursor-pointer text-sm text-admin-muted">
          {{ t('cmsEditor.inputSettings') }}
        </summary>
        <div class="mt-3 grid gap-4 md:grid-cols-2">
          <JsonField
            :label="t('cmsEditor.schemaSettings')"
            :value="objectValue(properties[name])"
            :locale
            :disabled="
              disabled ||
              invalid.has(`settings:${name}`) ||
              invalid.has(`input:${name}`)
            "
            @validity="validity(`schema:${name}`, $event)"
            @update="update(name, objectValue(raw), $event, required(name))"
          />
          <JsonField
            :label="t('cmsEditor.presentationSettings')"
            :value="objectValue(raw)"
            :locale
            :disabled="
              disabled ||
              invalid.has(`settings:${name}`) ||
              invalid.has(`schema:${name}`)
            "
            @validity="validity(`input:${name}`, $event)"
            @update="
              update(
                name,
                $event,
                objectValue(properties[name]),
                required(name)
              )
            "
          />
        </div>
      </details>
    </div>
    <JsonField
      :label="t('cmsEditor.inputBindings')"
      :value="objectValue(document.inputBindings)"
      :locale
      :disabled
      @validity="validity('bindings', $event)"
      @update="updateBindings"
    />
  </section>
</template>
