<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CodeTab } from './CodeTabs.vue'
import CodeTabs from './CodeTabs.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// The three call shapes from the Router PRD: direct, queue-backed, and
// fire-and-forget — all against the same model IDs and credit pool.
const callTabs: Record<string, CodeTab> = {
  run: {
    name: 'run',
    segments: [
      `# direct and blocking — prototyping
result = comfy.models.run(
    "google/nano-banana-2",
    arguments={"prompt": "a sunset over the ocean"},
)`
    ]
  },
  subscribe: {
    name: 'subscribe',
    segments: [
      `# queue-backed with progress callbacks — recommended
result = comfy.models.subscribe(
    "google/nano-banana-2",
    arguments={"prompt": "a black lab swimming"},
    with_logs=True,
    on_queue_update=print,
)`
    ]
  },
  submit: {
    name: 'submit',
    segments: [
      `# fire-and-forget — poll or rehydrate later, from any process
handle = comfy.models.submit(
    "kling/v3-omni",
    arguments={"prompt": "drone shot over a fjord", "duration": 5},
)
video = comfy.models.result("kling/v3-omni", handle.request_id)`
    ]
  }
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.modelsCalls.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.modelsCalls.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 max-w-3xl">
      <CodeTabs
        :tabs="callTabs"
        :label="t('platform.modelsCalls.heading', locale)"
      />
    </div>
  </section>
</template>
