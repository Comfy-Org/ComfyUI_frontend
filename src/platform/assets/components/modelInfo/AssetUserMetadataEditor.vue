<template>
  <div
    data-component-id="AssetUserMetadataEditor"
    class="flex min-w-0 flex-col gap-2 px-4 py-2 text-sm text-base-foreground"
  >
    <div
      v-if="parsedForEditor.customBucketState === 'invalid'"
      class="rounded-sm border border-border-default/60 bg-secondary-background/40 p-2 text-xs/snug text-muted-foreground"
      role="status"
    >
      <p class="text-foreground/90 mb-1 font-medium">
        {{ t('assetBrowser.modelInfo.customMetadataInvalidBucket') }}
      </p>
      <p
        class="line-clamp-4 font-mono text-[11px] leading-snug break-all text-muted-foreground"
      >
        {{ parsedForEditor.invalidCustomPreview }}
      </p>
    </div>
    <p v-if="introHintText" class="text-xs/snug text-muted-foreground">
      {{ introHintText }}
    </p>
    <p v-if="saveFailed" class="text-danger text-xs" role="alert">
      {{ t('assetBrowser.modelInfo.saveMetadataFailed') }}
    </p>

    <div class="flex min-w-0 flex-col gap-2">
      <div
        v-for="row in customPrimitiveRows"
        :key="row.key"
        class="flex min-w-0 flex-col gap-1"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <span
            class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            :title="row.key"
            >{{ row.key }}</span
          >
          <Select
            :model-value="row.primitiveType"
            :disabled="bucketLocksCustomEdits"
            @update:model-value="
              (v) => {
                if (v !== 'string' && v !== 'number' && v !== 'boolean') return
                onCustomPrimitiveTypeChange(
                  row.key,
                  row.primitiveType,
                  v,
                  row.value
                )
              }
            "
          >
            <SelectTrigger size="md" :class="cn(compactSelectTriggerClass)">
              <SelectValue>{{
                typeSelectLabel(row.primitiveType)
              }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">{{
                t('assetBrowser.modelInfo.metadataTypeString')
              }}</SelectItem>
              <SelectItem value="number">{{
                t('assetBrowser.modelInfo.metadataTypeNumber')
              }}</SelectItem>
              <SelectItem value="boolean">{{
                t('assetBrowser.modelInfo.metadataTypeBoolean')
              }}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-if="!bucketLocksCustomEdits"
            type="button"
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('assetBrowser.modelInfo.deleteMetadataField')"
            class="size-7 shrink-0 p-0"
            @click="emitDelete(row.key)"
          >
            <i class="icon-[lucide--trash-2] size-3.5" />
          </Button>
        </div>
        <div class="min-w-0 pl-0">
          <template v-if="row.primitiveType === 'boolean'">
            <label
              class="relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full outline-none focus-within:ring-1 focus-within:ring-border-default"
              :class="
                bucketLocksCustomEdits && 'pointer-events-none opacity-50'
              "
            >
              <input
                type="checkbox"
                class="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                role="switch"
                :aria-checked="row.value === true"
                :checked="row.value === true"
                :disabled="bucketLocksCustomEdits"
                @change="
                  onCustomPrimitiveValueChange(
                    row.key,
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
              <span
                class="peer-checked:bg-component-node-accent pointer-events-none absolute inset-0 rounded-full border border-border-default/50 bg-secondary-background transition-colors peer-checked:border-transparent"
                aria-hidden="true"
              />
              <span
                class="peer-checked:bg-foreground pointer-events-none absolute top-1/2 left-[3px] size-3.5 -translate-y-1/2 rounded-full bg-muted-foreground shadow-sm transition-[left,background-color] duration-200 ease-out peer-checked:left-[calc(100%-0.875rem-3px)]"
                aria-hidden="true"
              />
            </label>
          </template>
          <Input
            v-else-if="row.primitiveType === 'number'"
            :model-value="String(row.value)"
            :disabled="bucketLocksCustomEdits"
            :class="cn(compactValueInputClass)"
            @update:model-value="
              (v) =>
                onCustomNumberInput(
                  row.key,
                  typeof v === 'string' ? v : String(v)
                )
            "
          />
          <Input
            v-else
            :model-value="String(row.value)"
            :disabled="bucketLocksCustomEdits"
            :class="cn(compactValueInputClass)"
            @update:model-value="
              (v) =>
                onCustomPrimitiveValueChange(
                  row.key,
                  typeof v === 'string' ? v : String(v)
                )
            "
          />
        </div>
      </div>

      <div
        v-for="row in unsupportedInCustomRows"
        :key="'unsupported-' + row.key"
        class="flex min-w-0 flex-col gap-1 rounded-sm border border-border-default/50 bg-secondary-background/30 px-2 py-1.5"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <span
            class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            :title="row.key"
            >{{ row.key }}</span
          >
          <span
            class="shrink-0 rounded-sm bg-secondary-background px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {{ t('assetBrowser.modelInfo.customMetadataReadOnlyValue') }}
          </span>
        </div>
        <p
          class="line-clamp-4 min-w-0 font-mono text-[11px] leading-snug break-all text-muted-foreground"
          :title="row.preview"
        >
          {{ row.preview }}
        </p>
      </div>

      <div
        v-for="draft in draftCustomRows"
        :key="draft.id"
        class="flex min-w-0 flex-col gap-1"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <Input
            v-model="draft.key"
            :disabled="bucketLocksCustomEdits"
            :placeholder="t('assetBrowser.modelInfo.metadataKeyPlaceholder')"
            :class="cn(compactValueInputClass, 'min-w-0 flex-1')"
            @blur="tryCommitDraft(draft)"
          />
          <Select
            v-model="draft.primitiveType"
            :disabled="bucketLocksCustomEdits"
            @update:model-value="() => (draft.keyIssue = null)"
          >
            <SelectTrigger size="md" :class="cn(compactSelectTriggerClass)">
              <SelectValue>{{
                typeSelectLabel(draft.primitiveType)
              }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">{{
                t('assetBrowser.modelInfo.metadataTypeString')
              }}</SelectItem>
              <SelectItem value="number">{{
                t('assetBrowser.modelInfo.metadataTypeNumber')
              }}</SelectItem>
              <SelectItem value="boolean">{{
                t('assetBrowser.modelInfo.metadataTypeBoolean')
              }}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-if="!bucketLocksCustomEdits"
            type="button"
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('assetBrowser.modelInfo.removeDraftField')"
            class="size-7 shrink-0 p-0"
            @click="removeDraft(draft.id)"
          >
            <i class="icon-[lucide--x] size-3.5" />
          </Button>
        </div>
        <div class="min-w-0">
          <template v-if="draft.primitiveType === 'boolean'">
            <label
              class="relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full outline-none focus-within:ring-1 focus-within:ring-border-default"
              :class="
                bucketLocksCustomEdits && 'pointer-events-none opacity-50'
              "
            >
              <input
                v-model="draft.valueBool"
                type="checkbox"
                class="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                role="switch"
                :aria-checked="draft.valueBool"
                :disabled="bucketLocksCustomEdits"
                @change="tryCommitDraft(draft)"
              />
              <span
                class="peer-checked:bg-component-node-accent pointer-events-none absolute inset-0 rounded-full border border-border-default/50 bg-secondary-background transition-colors peer-checked:border-transparent"
                aria-hidden="true"
              />
              <span
                class="peer-checked:bg-foreground pointer-events-none absolute top-1/2 left-[3px] size-3.5 -translate-y-1/2 rounded-full bg-muted-foreground shadow-sm transition-[left,background-color] duration-200 ease-out peer-checked:left-[calc(100%-0.875rem-3px)]"
                aria-hidden="true"
              />
            </label>
          </template>
          <Input
            v-else-if="draft.primitiveType === 'number'"
            v-model="draft.valueStr"
            :disabled="bucketLocksCustomEdits"
            :class="cn(compactValueInputClass)"
            @blur="tryCommitDraft(draft)"
          />
          <Input
            v-else
            v-model="draft.valueStr"
            :disabled="bucketLocksCustomEdits"
            :class="cn(compactValueInputClass)"
            @blur="tryCommitDraft(draft)"
          />
        </div>
        <p v-if="draft.keyIssue" class="text-danger text-xs/snug">
          {{
            t(`assetBrowser.modelInfo.customMetadataKeyError.${draft.keyIssue}`)
          }}
        </p>
      </div>

      <Button
        v-if="!bucketLocksCustomEdits"
        type="button"
        variant="muted-textonly"
        size="unset"
        class="hover:text-foreground h-auto min-h-0 self-start px-0 py-0.5 text-xs text-muted-foreground"
        @click="addDraftRow"
      >
        <span class="inline-flex items-center gap-1">
          <i class="icon-[lucide--plus] size-3.5 shrink-0 opacity-70" />
          {{ t('assetBrowser.modelInfo.addCustomMetadataField') }}
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import type {
  CustomMetadataKeyIssue,
  UserMetadataPrimitiveType
} from '@/platform/assets/utils/assetUserMetadataEditorUtils'
import {
  parseUserMetadataForEditor,
  validateCustomMetadataKey
} from '@/platform/assets/utils/assetUserMetadataEditorUtils'
import { cn } from '@comfyorg/tailwind-utils'

type DraftCustomRow = {
  id: string
  key: string
  primitiveType: UserMetadataPrimitiveType
  valueStr: string
  valueBool: boolean
  keyIssue: CustomMetadataKeyIssue | null
}

const compactSelectTriggerClass = cn(
  'h-7 min-h-7 w-auto max-w-23 shrink-0 gap-0.5 border-0',
  'bg-node-component-widget-background/50 px-2 py-0 text-[11px] leading-none font-medium',
  'hover:bg-node-component-widget-background text-muted-foreground',
  '[&_i]:size-3 [&>span]:truncate'
)

const compactValueInputClass = cn(
  'h-8 min-h-8 w-full min-w-0 text-xs',
  'bg-node-component-widget-background/40 border-0 px-2.5 py-1',
  'text-component-node-foreground placeholder:text-muted-foreground',
  'focus-visible:bg-node-component-widget-background focus-visible:ring-1 focus-visible:ring-border-default'
)

const { t } = useI18n()

const {
  mergedMetadata,
  isImmutable,
  saveFailed = false
} = defineProps<{
  mergedMetadata: Record<string, unknown>
  isImmutable: boolean
  saveFailed?: boolean
}>()

const emit = defineEmits<{
  queueCustomChange: [
    patch: Record<string, string | number | boolean>,
    deleteKeys: string[]
  ]
}>()

function typeSelectLabel(type: UserMetadataPrimitiveType): string {
  switch (type) {
    case 'string':
      return t('assetBrowser.modelInfo.metadataTypeString')
    case 'number':
      return t('assetBrowser.modelInfo.metadataTypeNumber')
    case 'boolean':
      return t('assetBrowser.modelInfo.metadataTypeBoolean')
  }
}

const parsedForEditor = computed(() =>
  parseUserMetadataForEditor(mergedMetadata)
)

const customPrimitiveRows = computed(
  () => parsedForEditor.value.customPrimitives
)

const unsupportedInCustomRows = computed(
  () => parsedForEditor.value.unsupportedInCustom
)

const bucketLocksCustomEdits = computed(
  () => isImmutable || parsedForEditor.value.customBucketState === 'invalid'
)

const draftCustomRows = ref<DraftCustomRow[]>([])

const introHintText = computed(() => {
  const parsed = parsedForEditor.value
  if (parsed.customBucketState === 'invalid') {
    return undefined
  }
  const noPrimitives = parsed.customPrimitives.length === 0
  const noUnsupported = parsed.unsupportedInCustom.length === 0
  const noDrafts = draftCustomRows.value.length === 0
  if (isImmutable && noPrimitives && noUnsupported && noDrafts) {
    return t('assetBrowser.modelInfo.noCustomMetadata')
  }
  if (!isImmutable && noPrimitives && noDrafts) {
    return t('assetBrowser.modelInfo.customMetadataHint')
  }
  return undefined
})

watch(
  () => mergedMetadata,
  () => {
    const parsed = parseUserMetadataForEditor(mergedMetadata)
    const keysInCustom = new Set([
      ...parsed.customPrimitives.map((r) => r.key),
      ...parsed.unsupportedInCustom.map((r) => r.key)
    ])
    draftCustomRows.value = draftCustomRows.value.filter((d) => {
      const trimmed = d.key.trim()
      return !trimmed || !keysInCustom.has(trimmed)
    })
  },
  { deep: true }
)

function addDraftRow() {
  draftCustomRows.value.push({
    id: crypto.randomUUID(),
    key: '',
    primitiveType: 'string',
    valueStr: '',
    valueBool: false,
    keyIssue: null
  })
}

function removeDraft(id: string) {
  draftCustomRows.value = draftCustomRows.value.filter((d) => d.id !== id)
}

function emitDelete(key: string) {
  if (bucketLocksCustomEdits.value) return
  emit('queueCustomChange', {}, [key])
}

function onCustomPrimitiveValueChange(
  key: string,
  value: string | number | boolean
) {
  if (bucketLocksCustomEdits.value) return
  emit('queueCustomChange', { [key]: value }, [])
}

function onCustomNumberInput(key: string, raw: string) {
  if (bucketLocksCustomEdits.value) return
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  emit('queueCustomChange', { [key]: n }, [])
}

function coerceForTypeChange(
  newType: UserMetadataPrimitiveType,
  previous: UserMetadataPrimitiveType,
  value: string | number | boolean
): string | number | boolean {
  if (newType === 'boolean') {
    if (previous === 'number') return Boolean(value)
    if (previous === 'string') return value === 'true' || value === '1'
    return Boolean(value)
  }
  if (newType === 'number') {
    if (typeof value === 'number') return value
    if (typeof value === 'boolean') return value ? 1 : 0
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return String(value)
}

function onCustomPrimitiveTypeChange(
  key: string,
  oldType: UserMetadataPrimitiveType,
  newType: UserMetadataPrimitiveType,
  value: string | number | boolean
) {
  if (oldType === newType) return
  if (bucketLocksCustomEdits.value) return
  const next = coerceForTypeChange(newType, oldType, value)
  emit('queueCustomChange', { [key]: next }, [])
}

function draftKeyConflicts(trimmedKey: string, selfId: string): boolean {
  if (customPrimitiveRows.value.some((r) => r.key === trimmedKey)) {
    return true
  }
  if (unsupportedInCustomRows.value.some((r) => r.key === trimmedKey)) {
    return true
  }
  return draftCustomRows.value.some(
    (d) => d.id !== selfId && d.key.trim() === trimmedKey
  )
}

function tryCommitDraft(draft: DraftCustomRow) {
  if (bucketLocksCustomEdits.value) return
  const keyResult = validateCustomMetadataKey(draft.key)
  if (!keyResult.ok) {
    draft.keyIssue = keyResult.issue
    return
  }
  draft.keyIssue = null
  const trimmedKey = draft.key.trim()
  if (draftKeyConflicts(trimmedKey, draft.id)) {
    draft.keyIssue = 'duplicate'
    return
  }
  let value: string | number | boolean
  if (draft.primitiveType === 'boolean') {
    value = draft.valueBool
  } else if (draft.primitiveType === 'number') {
    const n = Number(draft.valueStr)
    if (!Number.isFinite(n)) return
    value = n
  } else {
    value = draft.valueStr
  }
  emit('queueCustomChange', { [trimmedKey]: value }, [])
  removeDraft(draft.id)
}
</script>
