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

const {
  tile,
  url,
  cancelling = false,
  cancelFailed = false,
  locale = 'en'
} = defineProps<{
  tile?: SavedAssetTile
  url?: string
  cancelling?: boolean
  cancelFailed?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ close: []; cancel: [] }>()

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
