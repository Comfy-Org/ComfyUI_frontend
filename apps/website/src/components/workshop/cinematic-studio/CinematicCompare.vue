<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CinematicComparisonDifferences from './CinematicComparisonDifferences.vue'
import {
  readComparisonSelection,
  saveComparisonSelection
} from '../../../lib/workshop/cinematic-studio/comparison-selection'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import {
  comparisonCanShow,
  comparisonPair
} from '../../../lib/workshop/cinematic-studio/comparison'
import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import CinematicComparisonPanel from './CinematicComparisonPanel.vue'
import { comparisonPanel, comparisonValues } from './comparison-view'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open: isOpen,
  items,
  urls,
  models = [],
  busy = false,
  namespace,
  locale = 'en'
} = defineProps<{
  open: boolean
  items: readonly SavedCreation[]
  urls: Readonly<Record<string, string>>
  namespace?: string
  busy?: boolean
  models?: readonly { slug: string; name: string }[]
  locale?: Locale
}>()
const emit = defineEmits<{
  'update:open': [boolean]
  reuse: [item: SavedCreation]
  animate: [url: string, name: string]
}>()
const open = computed({
  get: () => isOpen,
  set: (value: boolean) => emit('update:open', value)
})
const t = (key: ComparisonCopyKey) => tcComparison(key, locale)
const leftId = ref('')
const rightId = ref('')
const revealed = ref<readonly string[]>([])
const pair = computed(() => comparisonPair(items, leftId.value, rightId.value))
const panels = computed(() =>
  pair.value.flatMap((item, index) =>
    item ? [comparisonPanel(item, index, items, models)] : []
  )
)
const fieldClass =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
watch(
  () => namespace,
  () => {
    const saved = readComparisonSelection(namespace)
    leftId.value = saved?.[0] ?? ''
    rightId.value = saved?.[1] ?? ''
    revealed.value = []
  },
  { immediate: true, flush: 'sync' }
)
watch(
  () => [
    open.value,
    ...items.map((item) => item.id),
    leftId.value,
    rightId.value
  ],
  () => {
    revealed.value = []
  }
)
function select(side: 'left' | 'right', event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const selectedIds = pair.value.map((item) => item?.id)
  selectedIds[side === 'left' ? 0 : 1] = event.target.value
  const [left, right] = comparisonPair(items, selectedIds[0], selectedIds[1])
  leftId.value = left?.id ?? ''
  rightId.value = right?.id ?? ''
  if (left && right) saveComparisonSelection(namespace, [left.id, right.id])
}
function reuse(item: SavedCreation) {
  if (
    busy ||
    (item.settings?.operation && item.settings.operation !== 'generate')
  )
    return
  emit('reuse', item)
  open.value = false
}
function animate(item: SavedCreation) {
  if (
    busy ||
    item.kind !== 'image' ||
    !comparisonCanShow(item, revealed.value, urls[item.id])
  )
    return
  emit('animate', urls[item.id], item.fileName)
  open.value = false
}
function reveal(id: string) {
  revealed.value = [...revealed.value, id]
}
const differences = computed(() => {
  const [left, right] = pair.value
  if (!left || !right) return []
  const a = comparisonValues(left, locale)
  const b = comparisonValues(right, locale)
  const keys = Object.keys(a) as (keyof typeof a)[]
  return keys
    .filter((key) => a[key] !== undefined || b[key] !== undefined)
    .map((key) => ({
      key,
      changed: a[key] !== b[key],
      left:
        key === 'model'
          ? (models.find((model) => model.slug === a[key])?.name ?? a[key])
          : a[key],
      right:
        key === 'model'
          ? (models.find((model) => model.slug === b[key])?.name ?? b[key])
          : b[key]
    }))
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex max-h-[90svh] flex-col overflow-y-auto sm:max-w-6xl"
      :close-label="t('close')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <p
        v-if="items.length < 2"
        role="status"
        class="text-sm text-primary-comfy-canvas"
      >
        {{ t('empty') }}
      </p>
      <template v-else>
        <div class="grid gap-4 sm:grid-cols-2">
          <label
            class="flex min-w-0 flex-col gap-2 text-sm text-primary-warm-white"
            >{{ t('first')
            }}<select
              :value="pair[0]?.id"
              :class="fieldClass"
              @change="select('left', $event)"
            >
              <option
                v-for="item in items.filter(
                  (value) => value.id !== pair[1]?.id
                )"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select></label
          >
          <label
            class="flex min-w-0 flex-col gap-2 text-sm text-primary-warm-white"
            >{{ t('second')
            }}<select
              :value="pair[1]?.id"
              :class="fieldClass"
              @change="select('right', $event)"
            >
              <option
                v-for="item in items.filter(
                  (value) => value.id !== pair[0]?.id
                )"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select></label
          >
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <CinematicComparisonPanel
            v-for="panel in panels"
            :key="`${panel.index}-${panel.item.id}`"
            :panel
            :locale
            :open
            :revealed
            :urls
            :busy
            @reveal="reveal"
            @reuse="reuse"
            @animate="animate"
          />
        </div>
        <CinematicComparisonDifferences :differences :locale />
      </template>
    </DialogContent>
  </Dialog>
</template>
