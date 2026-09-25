<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import { useSavedModelResults } from '../../../composables/useSavedModelResults'
import { tcModelResults } from '../../../lib/workshop/cinematic-studio/model-results-copy'
import Button from '../../ui/button/Button.vue'

const { namespace, locale = 'en' } = defineProps<{
  namespace?: string
  locale?: Locale
}>()
const emit = defineEmits<{
  animate: [url: string, name: string]
  edit: [url: string, name: string]
}>()
const t = (key: Parameters<typeof tcModelResults>[0]) =>
  tcModelResults(key, locale)
const { items, urls, loading, error, refresh, remove } = useSavedModelResults(
  () => namespace
)
const query = ref('')
const kind = ref('all')
const revealed = ref<readonly string[]>([])
const removing = ref<string>()
watch(
  () => namespace,
  () => {
    revealed.value = []
    removing.value = undefined
  }
)
const visible = computed(() =>
  items.value.filter(
    (item) =>
      `${item.name} ${item.modelSlug}`
        .toLowerCase()
        .includes(query.value.toLowerCase()) &&
      (kind.value === 'all' ||
        item.outputs.some((output) => output.kind === kind.value))
  )
)
const outputKinds = ['image', 'video', 'audio', 'text', '3d', 'other'] as const
async function confirmRemove(id: string) {
  await remove(id)
  removing.value = undefined
}
</script>

<template>
  <section :aria-label="t('models')" class="min-w-0 text-primary-warm-white">
    <p class="my-3 text-sm text-primary-comfy-canvas">{{ t('description') }}</p>
    <div class="my-4 flex flex-wrap gap-3">
      <input
        v-model="query"
        type="search"
        :aria-label="t('search')"
        :placeholder="t('search')"
        class="min-w-0 flex-1 basis-full rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm sm:basis-auto"
      />
      <select
        v-model="kind"
        :aria-label="t('all')"
        class="rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm"
      >
        <option value="all">{{ t('all') }}</option>
        <option v-for="value in outputKinds" :key="value" :value="value">
          {{ t(value) }}
        </option>
      </select>
      <Button variant="outline" :disabled="loading" @click="refresh">{{
        t('refresh')
      }}</Button>
    </div>
    <p v-if="loading" role="status">{{ t('loading') }}</p>
    <p v-if="error" role="alert">{{ t('loadError') }}</p>
    <p
      v-if="!loading && !visible.length"
      class="py-8 text-center text-primary-comfy-canvas"
    >
      {{ t('empty') }}
    </p>
    <div class="grid gap-4 sm:grid-cols-2">
      <article
        v-for="item in visible"
        :key="item.id"
        class="min-w-0 rounded-xl border border-transparency-white-t20 p-3"
      >
        <h3 class="font-semibold wrap-break-word">{{ item.name }}</h3>
        <p class="my-2 text-xs wrap-break-word text-primary-comfy-canvas">
          {{ item.modelSlug }}
        </p>
        <div v-for="(output, index) in item.outputs" :key="index" class="my-3">
          <template
            v-if="output.nsfw && !revealed.includes(`${item.id}:${index}`)"
          >
            <p class="my-3 text-sm">{{ t('hidden') }}</p>
            <Button
              variant="outline"
              @click="revealed = [...revealed, `${item.id}:${index}`]"
              >{{ t('reveal') }}</Button
            >
          </template>
          <template v-else>
            <img
              v-if="output.kind === 'image'"
              :src="urls[item.id]?.[index]"
              :alt="output.fileName"
              loading="lazy"
              class="aspect-video w-full rounded-lg object-contain"
            />
            <video
              v-else-if="output.kind === 'video'"
              :src="urls[item.id]?.[index]"
              :aria-label="output.fileName"
              controls
              playsinline
              preload="none"
              class="aspect-video w-full rounded-lg"
            />
            <audio
              v-else-if="output.kind === 'audio'"
              :src="urls[item.id]?.[index]"
              :aria-label="output.fileName"
              controls
              preload="none"
              class="w-full"
            />
            <p v-else class="py-4 text-sm">
              {{ t('file') }} · {{ t(output.kind) }}
            </p>
            <p class="my-2 text-xs wrap-break-word">{{ output.fileName }}</p>
            <div class="flex flex-wrap gap-2">
              <a
                :href="urls[item.id]?.[index]"
                :download="output.fileName"
                class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm"
                >{{ t('download') }}</a
              >
              <template
                v-if="output.kind === 'image' && urls[item.id]?.[index]"
              >
                <Button
                  variant="outline"
                  size="sm"
                  @click="
                    emit('animate', urls[item.id][index], output.fileName)
                  "
                  >{{ t('animate') }}</Button
                >
                <Button
                  variant="outline"
                  size="sm"
                  @click="emit('edit', urls[item.id][index], output.fileName)"
                  >{{ t('edit') }}</Button
                >
              </template>
            </div>
          </template>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            :href="`/models/${encodeURIComponent(item.modelSlug)}/`"
            class="rounded-lg border border-transparency-white-t20 px-3 py-2 text-sm"
            >{{ t('openModel') }}</a
          >
          <Button variant="outline" size="sm" @click="removing = item.id">{{
            t('remove')
          }}</Button>
        </div>
        <div v-if="removing === item.id" class="mt-3 text-sm">
          <p>{{ t('confirm') }}</p>
          <div class="mt-2 flex gap-2">
            <Button size="sm" @click="confirmRemove(item.id)">{{
              t('remove')
            }}</Button>
            <Button size="sm" variant="outline" @click="removing = undefined">{{
              t('cancel')
            }}</Button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
