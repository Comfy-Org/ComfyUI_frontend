<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import LiveTerminal from './LiveTerminal.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Command surface from comfy-cli's build + deploy stack (PRs #801-805):
// `comfy build init`, `build push --release`, whose `--target` decides
// whether `deploy up` finds a deployable artifact, and `deploy up`. All
// three default to the current directory.
const deployTranscript = [
  '$ comfy build init',
  '✔ Scanned this ComfyUI install — custom nodes, models, pinned deps',
  '$ comfy build push --release --target linux/nvidia',
  '✔ Build released',
  '$ comfy deploy up',
  '✔ Endpoint live → https://your-build.run.comfy.app'
]
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-10 pb-4 lg:pt-14 lg:pb-6">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessDeploy.shipHeading', locale) }}
      <template #subtitle>
        <p
          class="text-smoke-700 mx-auto mt-4 max-w-2xl text-sm whitespace-pre-line"
        >
          {{ t('platform.serverlessDeploy.shipSubtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 max-w-3xl">
      <LiveTerminal
        :lines="deployTranscript"
        :label="t('platform.serverlessDeploy.heading', locale)"
      />
    </div>
  </section>
</template>
