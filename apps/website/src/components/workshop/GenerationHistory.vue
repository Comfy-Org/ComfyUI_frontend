<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import {
  cancelWorkshopGeneration,
  generationPending,
  getWorkshopGeneration,
  listWorkshopGenerations
} from '../../config/workshop-generation-assets'
import type { SavedGeneration } from '../../config/workshop-generation-assets'
import { t } from '../../i18n/translations'
import type { Locale, TranslationKey } from '../../i18n/translations'
import SavedGenerationMedia from './SavedGenerationMedia.vue'

const {
  modelId,
  activeRequestId,
  token,
  locale = 'en'
} = defineProps<{
  modelId: string
  activeRequestId: string | null
  token: () => Promise<string>
  locale?: Locale
}>()

const generations = ref<SavedGeneration[]>([])
const nextCursor = ref<string>()
const allModels = ref(false)
const failed = ref(false)
const loading = ref(false)
const cancelling = ref<string>()
const cancelFailed = ref(false)
const controller = new AbortController()
let timer: ReturnType<typeof setTimeout> | undefined
let sequence = 0
let mounted = false
let expanded = false

const saveLabels: Record<SavedGeneration['asset_save_status'], TranslationKey> =
  {
    pending: 'workshop.history.saving',
    saving: 'workshop.history.saving',
    saved: 'workshop.history.saved',
    partial: 'workshop.history.partial',
    failed: 'workshop.history.saveFailed',
    not_applicable: 'workshop.history.noOutput'
  }

function statusLabel(generation: SavedGeneration): string {
  return t(
    generation.status === 'COMPLETED'
      ? saveLabels[generation.asset_save_status]
      : 'workshop.history.generating',
    locale
  )
}

async function refresh(append = false) {
  const attempt = ++sequence
  clearTimeout(timer)
  loading.value = true
  try {
    const credential = await token()
    const page = await listWorkshopGenerations(
      credential,
      controller.signal,
      allModels.value ? undefined : modelId,
      append ? nextCursor.value : undefined
    )
    if (
      activeRequestId &&
      !append &&
      !page.requests.some((request) => request.request_id === activeRequestId)
    ) {
      const active = await getWorkshopGeneration(
        modelId,
        activeRequestId,
        credential,
        controller.signal
      )
      if (active) page.requests.unshift(active)
    }
    if (!append) {
      const olderPending = generations.value.filter(
        (generation) =>
          generationPending(generation) &&
          !page.requests.some(
            (item) => item.request_id === generation.request_id
          )
      )
      const updated = await Promise.all(
        olderPending.map((generation) =>
          getWorkshopGeneration(
            `${generation.provider}/${generation.model}`,
            generation.request_id,
            credential,
            controller.signal
          )
        )
      )
      for (const generation of updated)
        if (generation) page.requests.push(generation)
    }
    if (controller.signal.aborted || attempt !== sequence) return
    generations.value = [
      ...new Map(
        [...generations.value, ...page.requests].map((request) => [
          request.request_id,
          request
        ])
      ).values()
    ].sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) ||
        b.request_id.localeCompare(a.request_id)
    )
    if (append || !expanded) nextCursor.value = page.next_cursor
    if (append) expanded = true
    failed.value = false
  } catch {
    if (controller.signal.aborted || attempt !== sequence) return
    failed.value = true
  } finally {
    if (!controller.signal.aborted && attempt === sequence) {
      loading.value = false
      if (failed.value || generations.value.some(generationPending))
        timer = setTimeout(() => void refresh(), failed.value ? 15_000 : 3_000)
    }
  }
}

async function cancel(generation: SavedGeneration) {
  if (cancelling.value) return
  cancelling.value = generation.request_id
  cancelFailed.value = false
  try {
    await cancelWorkshopGeneration(generation, await token(), controller.signal)
    if (!controller.signal.aborted) await refresh()
  } catch {
    if (!controller.signal.aborted) cancelFailed.value = true
  } finally {
    cancelling.value = undefined
  }
}

onMounted(() => {
  mounted = true
  void refresh()
})
watch(
  () => activeRequestId,
  () => {
    if (mounted) void refresh()
  }
)
watch(allModels, () => {
  generations.value = []
  nextCursor.value = undefined
  expanded = false
  if (mounted) void refresh()
})
onScopeDispose(() => {
  controller.abort()
  clearTimeout(timer)
})
</script>

<template>
  <section
    :aria-label="t('workshop.history.title', locale)"
    class="flex flex-col gap-4 border-t border-transparency-white-t8 pt-6"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-medium">
        {{ t('workshop.history.title', locale) }}
      </h2>
      <Button
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="refresh()"
        >{{ t('workshop.history.refresh', locale) }}</Button
      >
    </div>
    <label class="flex items-center gap-2 text-sm"
      ><input v-model="allModels" type="checkbox" />{{
        t('workshop.history.allModels', locale)
      }}</label
    >
    <p class="text-sm text-primary-warm-gray">
      {{ t('workshop.history.retained', locale) }}
    </p>
    <p v-if="failed" role="alert" class="text-sm">
      {{ t('workshop.history.loadError', locale) }}
    </p>
    <p v-if="cancelFailed" role="alert" class="text-sm">
      {{ t('workshop.history.cancelError', locale) }}
    </p>
    <p
      v-if="!loading && !failed && !generations.length"
      class="text-sm text-primary-warm-gray"
    >
      {{ t('workshop.history.empty', locale) }}
    </p>
    <article
      v-for="generation in generations"
      :key="generation.request_id"
      class="flex flex-col gap-3 rounded-xl border border-transparency-white-t8 p-4"
      :aria-current="
        generation.request_id === activeRequestId ? 'true' : undefined
      "
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm"
          >{{ generation.provider }}/{{ generation.model }}</span
        >
        <span class="text-sm text-primary-warm-gray" role="status">{{
          statusLabel(generation)
        }}</span>
      </div>
      <time
        :datetime="generation.created_at"
        class="text-xs text-primary-warm-gray"
        >{{ new Date(generation.created_at).toLocaleString(locale) }}</time
      >
      <template
        v-for="output in generation.asset_outputs"
        :key="output.asset_id"
      >
        <SavedGenerationMedia
          v-if="output.status === 'saved'"
          :output
          :token
          :locale
        />
        <p
          v-else-if="
            output.status === 'failed' || output.status === 'unavailable'
          "
          class="text-sm text-primary-warm-gray"
        >
          {{
            t(
              output.status === 'unavailable'
                ? 'workshop.history.unavailable'
                : 'workshop.history.saveFailed',
              locale
            )
          }}
        </p>
      </template>
      <p class="text-xs break-all text-primary-warm-gray">
        {{ t('workshop.run.requestId', locale) }} {{ generation.request_id }}
      </p>
      <Button
        v-if="generation.status !== 'COMPLETED'"
        variant="outline"
        size="sm"
        :disabled="!!cancelling"
        @click="cancel(generation)"
        >{{ t('workshop.run.cancel', locale) }}</Button
      >
    </article>
    <Button
      v-if="nextCursor"
      variant="outline"
      :disabled="loading"
      @click="refresh(true)"
      >{{ t('workshop.history.more', locale) }}</Button
    >
  </section>
</template>
