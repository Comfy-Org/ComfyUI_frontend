<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import {
  accessWorkshopAsset,
  GenerationAccessError
} from '../../config/workshop-generation-assets'
import type { SavedGenerationOutput } from '../../config/workshop-generation-assets'
import { t } from '../../i18n/translations'
import type { Locale } from '../../i18n/translations'

const { output, token, locale } = defineProps<{
  output: SavedGenerationOutput
  token: () => Promise<string>
  locale: Locale
}>()

const contentUrl = ref<string>()
const unavailable = ref(false)
const failed = ref(false)
const loading = ref(false)
const player = ref<HTMLMediaElement>()
const controller = new AbortController()
let timer: ReturnType<typeof setTimeout> | undefined
let position = 0
let playing = false
let expiresAt = 0
let retriedMedia = false

async function refresh() {
  if (loading.value || unavailable.value || controller.signal.aborted) return
  loading.value = true
  failed.value = false
  clearTimeout(timer)
  try {
    const access = await accessWorkshopAsset(
      output.asset_id,
      await token(),
      controller.signal
    )
    controller.signal.throwIfAborted()
    expiresAt = Date.parse(access.expires_at)
    if (expiresAt <= Date.now()) throw new Error('Expired media access')
    position = player.value?.currentTime ?? 0
    playing = player.value ? !player.value.paused : false
    contentUrl.value = access.content_url
    timer = setTimeout(
      () => void refresh(),
      Math.max(1000, expiresAt - Date.now() - 30_000)
    )
  } catch (error) {
    if (controller.signal.aborted) return
    unavailable.value =
      error instanceof GenerationAccessError &&
      (error.status === 404 || error.status === 410)
    if (!unavailable.value && contentUrl.value && expiresAt > Date.now()) {
      timer = setTimeout(() => void refresh(), 15_000)
    } else {
      failed.value = !unavailable.value
      contentUrl.value = undefined
    }
  } finally {
    loading.value = false
  }
}

function mediaError() {
  if (retriedMedia) {
    clearTimeout(timer)
    contentUrl.value = undefined
    failed.value = true
    return
  }
  retriedMedia = true
  void refresh()
}

function retry() {
  retriedMedia = false
  void refresh()
}

function restorePlayback() {
  if (!player.value) return
  if (position > 0) player.value.currentTime = position
  if (playing) void player.value.play().catch(() => {})
}

onMounted(() => void refresh())
onScopeDispose(() => {
  controller.abort()
  clearTimeout(timer)
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <p v-if="unavailable" class="text-sm text-primary-warm-gray">
      {{ t('workshop.history.unavailable', locale) }}
    </p>
    <div v-else-if="failed" class="flex items-center gap-2">
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.history.mediaError', locale) }}
      </p>
      <Button variant="outline" size="sm" @click="retry">{{
        t('workshop.history.retry', locale)
      }}</Button>
    </div>
    <template v-else-if="contentUrl">
      <img
        v-if="output.kind === 'image'"
        :src="contentUrl"
        :alt="t('workshop.history.generatedImage', locale)"
        loading="lazy"
        class="max-h-80 rounded-xl object-contain"
        @error="mediaError"
      />
      <video
        v-else-if="output.kind === 'video'"
        ref="player"
        :src="contentUrl"
        controls
        preload="metadata"
        class="max-h-80 w-full rounded-xl"
        @error="mediaError"
        @loadedmetadata="restorePlayback"
      />
      <audio
        v-else
        ref="player"
        :src="contentUrl"
        controls
        preload="metadata"
        class="w-full"
        @error="mediaError"
        @loadedmetadata="restorePlayback"
      />
      <a
        :href="contentUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-primary-comfy-yellow"
        >{{ t('workshop.history.open', locale) }}</a
      >
    </template>
    <p v-else class="text-sm text-primary-warm-gray" role="status">
      {{ t('workshop.history.loadingMedia', locale) }}
    </p>
    <div class="flex items-center gap-1">
      <span class="min-w-0 text-xs break-all text-primary-warm-gray"
        >{{ t('workshop.history.assetId', locale) }} {{ output.asset_id }}</span
      >
      <CopyTextButton
        :value="output.asset_id"
        :label="t('workshop.history.copyAssetId', locale)"
        :copied-label="t('workshop.api.copied', locale)"
        icon-class="size-3.5"
      />
    </div>
  </div>
</template>
