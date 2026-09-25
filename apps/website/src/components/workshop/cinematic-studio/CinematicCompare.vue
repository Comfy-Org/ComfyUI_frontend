<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import {
  cameraGroups,
  gradeGroup,
  lookGroups,
  directionOption
} from '../../../lib/workshop/cinematic-studio/catalog'
import { libraryCopy } from '../../../lib/workshop/cinematic-studio/library-copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import {
  comparisonCanShow,
  comparisonPair,
  comparisonSettings,
  comparisonSource
} from '../../../lib/workshop/cinematic-studio/comparison'
import { tcComparison } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import type { ComparisonCopyKey } from '../../../lib/workshop/cinematic-studio/comparison-copy'
import Button from '../../ui/button/Button.vue'
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
  locale = 'en'
} = defineProps<{
  open: boolean
  items: readonly SavedCreation[]
  urls: Readonly<Record<string, string>>
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
    item
      ? [
          {
            item,
            index,
            settings: comparisonSettings(item),
            source: comparisonSource(item, items),
            modelName:
              models.find((model) => model.slug === item.modelSlug)?.name ??
              item.modelSlug
          }
        ]
      : []
  )
)
const fieldClass =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'
watch(
  () => [open.value, ...items.map((item) => item.id)],
  () => {
    const [left, right] = comparisonPair(items, leftId.value, rightId.value)
    leftId.value = left?.id ?? ''
    rightId.value = right?.id ?? ''
    revealed.value = []
  },
  { immediate: true }
)
watch([leftId, rightId], () => {
  revealed.value = []
})
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
function directionLabels(item: SavedCreation) {
  const direction = item.settings?.direction
  if (!direction) return []
  return [...cameraGroups, ...lookGroups, gradeGroup].flatMap((group) => {
    const option = directionOption(group.part, direction)
    return option.id === 'auto' ? [] : [tc(option.label, locale)]
  })
}
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
            }}<select v-model="leftId" :class="fieldClass">
              <option
                v-for="item in items.filter((value) => value.id !== rightId)"
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
            }}<select v-model="rightId" :class="fieldClass">
              <option
                v-for="item in items.filter((value) => value.id !== leftId)"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select></label
          >
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <section
            v-for="panel in panels"
            :key="`${panel.index}-${panel.item.id}`"
            :aria-label="t(panel.index === 0 ? 'first' : 'second')"
            class="flex min-w-0 flex-col gap-3 rounded-xl border border-transparency-white-t20 p-3 text-primary-warm-white"
          >
            <h3 class="text-base font-semibold wrap-break-word">
              {{ panel.item.name }}
            </h3>
            <div
              class="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-primary-comfy-ink"
            >
              <template
                v-if="
                  open &&
                  comparisonCanShow(panel.item, revealed, urls[panel.item.id])
                "
              >
                <img
                  v-if="panel.item.kind === 'image'"
                  :src="urls[panel.item.id]"
                  :alt="panel.item.name"
                  class="h-full w-full object-contain"
                />
                <video
                  v-else
                  :src="urls[panel.item.id]"
                  :aria-label="`${t('video')}: ${panel.item.name}`"
                  controls
                  playsinline
                  preload="metadata"
                  class="h-full w-full object-contain"
                />
              </template>
              <div
                v-else-if="panel.item.nsfw && !revealed.includes(panel.item.id)"
                class="flex flex-col items-center gap-3 p-4 text-center"
              >
                <p class="text-sm">{{ t('hidden') }}</p>
                <Button
                  variant="outline"
                  size="sm"
                  @click="reveal(panel.item.id)"
                  >{{ t('reveal') }}</Button
                >
              </div>
              <p v-else class="p-4 text-sm text-primary-comfy-canvas">
                {{ t('unavailable') }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="
                  busy ||
                  (!!panel.item.settings?.operation &&
                    panel.item.settings.operation !== 'generate')
                "
                @click="reuse(panel.item)"
                >{{ libraryCopy('reuse', locale) }}</Button
              >
              <Button
                v-if="panel.item.kind === 'image'"
                variant="outline"
                size="sm"
                :disabled="
                  busy ||
                  !comparisonCanShow(panel.item, revealed, urls[panel.item.id])
                "
                @click="animate(panel.item)"
                >{{ libraryCopy('animate', locale) }}</Button
              >
            </div>
            <p
              v-if="
                panel.item.settings?.operation &&
                panel.item.settings.operation !== 'generate'
              "
              class="text-sm text-primary-comfy-canvas"
            >
              {{ t('editReuseUnavailable') }}
            </p>
            <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt class="text-primary-comfy-canvas">{{ t('model') }}</dt>
              <dd class="wrap-break-word">{{ panel.modelName }}</dd>
              <dt class="text-primary-comfy-canvas">{{ t('aspect') }}</dt>
              <dd>{{ panel.settings.aspect }}</dd>
              <template v-if="panel.settings.resolution"
                ><dt class="text-primary-comfy-canvas">
                  {{ t('resolution') }}
                </dt>
                <dd>{{ panel.settings.resolution }}</dd></template
              >
              <template v-if="panel.settings.duration !== undefined"
                ><dt class="text-primary-comfy-canvas">{{ t('duration') }}</dt>
                <dd>{{ panel.settings.duration }}s</dd></template
              >
              <template v-if="panel.settings.seed !== undefined"
                ><dt class="text-primary-comfy-canvas">{{ t('seed') }}</dt>
                <dd>{{ panel.settings.seed }}</dd></template
              >
              <template v-if="panel.settings.audio !== undefined"
                ><dt class="text-primary-comfy-canvas">{{ t('audio') }}</dt>
                <dd>{{ t(panel.settings.audio ? 'on' : 'off') }}</dd></template
              >
              <template v-if="panel.settings.operation"
                ><dt class="text-primary-comfy-canvas">{{ t('operation') }}</dt>
                <dd>{{ t(panel.settings.operation) }}</dd></template
              >
              <template v-if="panel.item.settings?.sourceId"
                ><dt class="text-primary-comfy-canvas">{{ t('source') }}</dt>
                <dd class="wrap-break-word">
                  {{ panel.source?.name ?? t('sourceMissing') }}
                </dd></template
              >
            </dl>
            <details>
              <summary class="cursor-pointer text-sm font-semibold">
                {{ t('prompt') }}
              </summary>
              <p
                class="mt-2 max-h-52 overflow-auto text-sm/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
                tabindex="0"
              >
                {{ panel.item.prompt }}
              </p>
            </details>
            <details>
              <summary class="cursor-pointer text-sm font-semibold">
                {{ t('settings') }}
              </summary>
              <p
                v-if="directionLabels(panel.item).length"
                class="mt-2 text-sm/relaxed wrap-break-word text-primary-comfy-canvas"
              >
                <span class="font-semibold">{{ t('direction') }}: </span
                >{{ directionLabels(panel.item).join(' · ') }}
              </p>
              <p v-else class="mt-2 text-sm text-primary-comfy-canvas">
                {{ t('noSettings') }}
              </p>
            </details>
          </section>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
