<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import {
  ASSET_IMAGE_TYPES,
  assetFile,
  cropAssetImage,
  cropBounds,
  deleteAsset,
  imageDimensions,
  listAssets,
  saveAsset,
  validateAsset
} from '../../../lib/workshop/cinematic-studio/assets'
import type {
  AssetReference,
  SavedAsset
} from '../../../lib/workshop/cinematic-studio/assets'
import { tcAssets } from '../../../lib/workshop/cinematic-studio/assets-copy'
import type { AssetCopyKey } from '../../../lib/workshop/cinematic-studio/assets-copy'
import CinematicAssetBrowser from './CinematicAssetBrowser.vue'
import CinematicAssetEditor from './CinematicAssetEditor.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  namespace,
  open,
  creations = [],
  locale = 'en'
} = defineProps<{
  namespace?: string
  open: boolean
  creations?: readonly SavedCreation[]
  locale?: Locale
}>()
const emit = defineEmits<{ close: []; use: [AssetReference] }>()
const t = (key: AssetCopyKey) => tcAssets(key, locale)
const assets = ref<SavedAsset[]>([])
const urls = ref<Record<string, string>>({})
const search = ref('')
const status = ref<AssetCopyKey | ''>('')
const busy = ref(false)
const draft = ref<SavedAsset>()
const preview = ref('')
const size = ref({ width: 1, height: 1 })
const crop = ref({ x: 0, y: 0, width: 1, height: 1 })
const pendingDelete = ref('')
const creationId = ref('')
let revision = 0
const fieldClass =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
const matches = computed(() =>
  assets.value.filter((asset) =>
    `${asset.name} ${asset.kind} ${asset.notes}`
      .toLowerCase()
      .includes(search.value.trim().toLowerCase())
  )
)
const images = computed(() =>
  creations.filter((creation) => creation.kind === 'image' && !creation.nsfw)
)
const valid = computed(() => {
  try {
    return !!draft.value && !!validateAsset(draft.value)
  } catch {
    return false
  }
})
const guide = computed<AssetCopyKey>(() =>
  draft.value?.kind === 'character'
    ? 'characterGuide'
    : draft.value?.kind === 'location'
      ? 'locationGuide'
      : 'propGuide'
)
const bounds = computed(() => {
  try {
    return cropBounds(crop.value, size.value.width, size.value.height)
  } catch {
    return undefined
  }
})
const cropStyle = computed(() =>
  bounds.value
    ? {
        left: `${(bounds.value.x / size.value.width) * 100}%`,
        top: `${(bounds.value.y / size.value.height) * 100}%`,
        width: `${(bounds.value.width / size.value.width) * 100}%`,
        height: `${(bounds.value.height / size.value.height) * 100}%`
      }
    : {}
)
function clearDraft() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  draft.value = undefined
  creationId.value = ''
}
function showAssets(values: SavedAsset[]) {
  Object.values(urls.value).forEach((url) => URL.revokeObjectURL(url))
  urls.value = Object.fromEntries(
    values.map((asset) => [asset.id, URL.createObjectURL(asset.blob)])
  )
  assets.value = values
}
watch(
  () => [namespace, open] as const,
  async ([scope, visible]) => {
    const current = ++revision
    clearDraft()
    showAssets([])
    pendingDelete.value = ''
    search.value = ''
    status.value = ''
    busy.value = false
    if (!visible || !scope) return
    busy.value = true
    try {
      const values = await listAssets(scope)
      if (current === revision) showAssets(values)
    } catch {
      if (current === revision) status.value = 'error'
    } finally {
      if (current === revision) busy.value = false
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  revision++
  clearDraft()
  Object.values(urls.value).forEach((url) => URL.revokeObjectURL(url))
})
async function selectImage(blob: Blob, name: string, saved?: SavedAsset) {
  if (busy.value || !namespace) return
  const current = revision
  busy.value = true
  status.value = ''
  try {
    const dimensions = await imageDimensions(blob)
    if (current !== revision) return
    clearDraft()
    size.value = dimensions
    crop.value = { x: 0, y: 0, ...dimensions }
    draft.value = saved
      ? { ...saved }
      : {
          id: crypto.randomUUID(),
          name: name.slice(0, 60),
          kind: 'character',
          notes: '',
          blob
        }
    preview.value = URL.createObjectURL(blob)
  } catch {
    if (current === revision) status.value = 'error'
  } finally {
    if (current === revision) busy.value = false
  }
}
function upload(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) void selectImage(file, file.name.replace(/\.[^.]+$/, ''))
}
function selectCreation() {
  const creation = images.value.find((value) => value.id === creationId.value)
  if (creation) void selectImage(creation.blob, creation.name)
}
async function applyCrop() {
  if (!draft.value || !bounds.value || busy.value) return
  const current = revision
  const selected = draft.value
  const selectedBounds = bounds.value
  busy.value = true
  status.value = ''
  try {
    const file = await cropAssetImage(selected.blob, selectedBounds)
    if (current !== revision) return
    URL.revokeObjectURL(preview.value)
    preview.value = URL.createObjectURL(file)
    draft.value = { ...selected, blob: file }
    size.value = { width: selectedBounds.width, height: selectedBounds.height }
    crop.value = { x: 0, y: 0, ...size.value }
  } catch {
    if (current === revision) status.value = 'error'
  } finally {
    if (current === revision) busy.value = false
  }
}
async function save() {
  if (!namespace || !draft.value || !valid.value || busy.value) return
  const scope = namespace
  const current = revision
  const value = validateAsset(draft.value)
  busy.value = true
  try {
    await saveAsset(scope, value)
    const values = await listAssets(scope)
    if (current === revision) {
      showAssets(values)
      status.value = 'saved'
    }
  } catch {
    if (current === revision) status.value = 'error'
  } finally {
    if (current === revision) busy.value = false
  }
}
function clearDeletedDraft(id: string) {
  if (draft.value?.id === id) clearDraft()
}
async function remove(id: string) {
  if (!namespace || busy.value || pendingDelete.value !== id) return
  const scope = namespace
  const current = revision
  busy.value = true
  try {
    await deleteAsset(scope, id)
    const values = await listAssets(scope)
    if (current === revision) {
      showAssets(values)
      pendingDelete.value = ''
      clearDeletedDraft(id)
    }
  } catch {
    if (current === revision) status.value = 'error'
  } finally {
    if (current === revision) busy.value = false
  }
}
function use(asset: SavedAsset) {
  if (!namespace || busy.value) return
  emit('use', {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    notes: asset.notes,
    file: assetFile(asset)
  })
}
</script>

<template>
  <Dialog :open @update:open="!$event && emit('close')">
    <DialogContent
      class="flex max-h-[90svh] flex-col overflow-y-auto sm:max-w-5xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <p v-if="!namespace" role="status">{{ t('unavailable') }}</p>
      <template v-else>
        <div class="grid gap-4 text-primary-warm-white sm:grid-cols-2">
          <label class="flex flex-col gap-2 text-sm"
            >{{ t('upload')
            }}<input
              type="file"
              :accept="ASSET_IMAGE_TYPES.join(',')"
              :disabled="busy"
              :class="fieldClass"
              @change="upload"
          /></label>
          <label v-if="images.length" class="flex flex-col gap-2 text-sm"
            >{{ t('creation')
            }}<select
              v-model="creationId"
              :disabled="busy"
              :class="fieldClass"
              @change="selectCreation"
            >
              <option value="">{{ t('choose') }}</option>
              <option
                v-for="creation in images"
                :key="creation.id"
                :value="creation.id"
              >
                {{ creation.name }}
              </option>
            </select></label
          >
        </div>
        <p class="text-xs text-primary-comfy-canvas">{{ t('uploadHint') }}</p>
        <CinematicAssetEditor
          v-if="draft"
          v-model:draft="draft"
          v-model:crop="crop"
          :preview
          :crop-style
          :size
          :busy
          :bounds="!!bounds"
          :valid
          :guide
          :field-class
          :locale
          @save="save"
          @apply-crop="applyCrop"
          @clear-draft="clearDraft"
        />
        <CinematicAssetBrowser
          v-model:search="search"
          v-model:pending-delete="pendingDelete"
          :matches
          :urls
          :busy
          :locale
          :field-class
          @use="use"
          @edit="selectImage($event.blob, $event.name, $event)"
          @remove="remove"
        />
      </template>
      <p
        v-if="busy || status"
        role="status"
        class="text-sm text-primary-comfy-canvas"
      >
        {{ t(busy ? 'busy' : status || 'busy') }}
      </p>
    </DialogContent>
  </Dialog>
</template>
