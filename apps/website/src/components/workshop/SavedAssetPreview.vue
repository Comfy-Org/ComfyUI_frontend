<script setup lang="ts">
import { Download, ExternalLink, Loader2, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
import { downloadOutput } from '../../config/workshop-output-download'
import { savedAssetFileName } from '../../lib/workshop/saved-assets'
import type { SavedAssetTile } from '../../lib/workshop/saved-assets'
import { t } from '../../i18n/translations'
import type { Locale } from '../../i18n/translations'
import SavedAssetMedia from './SavedAssetMedia.vue'
import SavedAssetPager from './SavedAssetPager.vue'

const {
  tile,
  url,
  position = { index: 0, total: 1 },
  cancelling = false,
  cancelFailed = false,
  locale = 'en'
} = defineProps<{
  tile?: SavedAssetTile
  url?: string
  /** Where the shown asset sits among the saved ones, for the pager. */
  position?: { index: number; total: number }
  cancelling?: boolean
  cancelFailed?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ close: []; cancel: []; step: [delta: number] }>()

const downloadFailed = ref(false)
watch(
  () => tile,
  () => (downloadFailed.value = false)
)

const media = computed(() =>
  tile?.state === 'saved' && url
    ? {
        kind: tile.kind,
        url,
        assetId: tile.assetId,
        fileName: savedAssetFileName(tile.assetId, tile.kind, url)
      }
    : undefined
)
const generating = computed(() => tile?.state === 'pending')
const downloadName = computed(() =>
  downloadFailed.value ? undefined : media.value?.fileName
)
const downloadIcon = computed(() =>
  downloadFailed.value ? ExternalLink : Download
)
const downloadLabel = computed(() =>
  t(
    downloadFailed.value
      ? 'workshop.output.openOriginal'
      : 'workshop.output.download',
    locale
  )
)

async function download(event: MouseEvent) {
  const current = media.value
  if (!current || downloadFailed.value) return
  event.preventDefault()
  downloadFailed.value = !(await downloadOutput(current.url, current.fileName))
}

function setOpen(open: boolean) {
  if (!open) emit('close')
}

// A swipe is how the strip is read on a phone, where the arrows are a small
// target beside a full-bleed picture.
const SWIPE_THRESHOLD_PX = 45
let touchStartX: number | undefined

function touchStart(event: TouchEvent) {
  touchStartX = event.changedTouches[0]?.clientX
}

function touchEnd(event: TouchEvent) {
  const startX = touchStartX
  touchStartX = undefined
  const endX = event.changedTouches[0]?.clientX
  if (startX === undefined || endX === undefined) return
  const travelled = endX - startX
  if (Math.abs(travelled) > SWIPE_THRESHOLD_PX)
    emit('step', travelled < 0 ? 1 : -1)
}
</script>

<template>
  <DialogRoot :open="tile !== undefined" @update:open="setOpen">
    <DialogPortal>
      <DialogContent
        v-if="tile"
        class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-4 bg-primary-comfy-ink/90 p-6 backdrop-blur-sm"
        :aria-describedby="undefined"
        data-testid="saved-asset-preview"
        @click.self="emit('close')"
        @keydown.left="emit('step', -1)"
        @keydown.right="emit('step', 1)"
        @touchstart.passive="touchStart"
        @touchend.passive="touchEnd"
      >
        <DialogTitle class="sr-only">
          {{ t('workshop.assets.title', locale) }}
        </DialogTitle>
        <button
          type="button"
          :aria-label="t('workshop.output.collapse', locale)"
          class="absolute top-6 right-6 grid size-8 cursor-pointer place-items-center rounded-lg bg-primary-comfy-ink/70 text-primary-warm-white transition-colors hover:text-primary-comfy-yellow"
          data-testid="saved-asset-close"
          @click="emit('close')"
        >
          <X class="size-4" aria-hidden="true" />
        </button>

        <template v-if="media">
          <SavedAssetMedia
            :kind="media.kind"
            :url="media.url"
            :asset-id="media.assetId"
            :alt="t('workshop.assets.title', locale)"
            controls
            class="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain"
          />
          <Button
            as="a"
            :href="media.url"
            :download="downloadName"
            :prepend-icon="downloadIcon"
            target="_blank"
            rel="noopener"
            size="sm"
            data-testid="saved-asset-download"
            @click="download"
          >
            {{ downloadLabel }}
          </Button>

          <SavedAssetPager
            v-if="position.total > 1"
            :index="position.index"
            :total="position.total"
            :locale
            @step="(delta: number) => emit('step', delta)"
          />
        </template>

        <template v-else-if="generating">
          <Loader2
            class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
            aria-hidden="true"
          />
          <p class="text-sm text-primary-warm-white">
            {{ t('workshop.assets.generating', locale) }}
          </p>
          <p
            v-if="cancelFailed"
            role="alert"
            class="text-xs text-primary-comfy-red"
          >
            {{ t('workshop.assets.cancelError', locale) }}
          </p>
          <Button
            variant="outline"
            size="sm"
            :disabled="cancelling"
            @click="emit('cancel')"
          >
            {{ t('workshop.run.cancel', locale) }}
          </Button>
        </template>

        <p v-else role="status" class="text-sm text-primary-warm-gray">
          {{ t('workshop.assets.loadingMedia', locale) }}
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
