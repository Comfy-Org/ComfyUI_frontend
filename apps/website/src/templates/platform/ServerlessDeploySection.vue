<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CodeTab } from './CodeTabs.vue'
import CodeTabs from './CodeTabs.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Command surface from comfy-cli's build + deploy stack (PRs #801-805):
// `comfy build init` (or `--from-workflow`, which resolves no ComfyUI version
// and so needs `--comfy-version` before a release can be cut), `build push
// --release`, whose `--target` decides whether `deploy up` finds a deployable
// artifact, and `deploy up`. All three default to the current directory.
function terminalSegments(transcript: string): CodeTab['segments'] {
  const lines = transcript.split('\n')
  return lines.flatMap((line, index) => [
    { values: [line.slice(0, 1)], highlight: true },
    line.slice(1) + (index < lines.length - 1 ? '\n' : '')
  ])
}

const deployTabs: Record<string, CodeTab> = {
  install: {
    name: t('platform.serverlessDeploy.tabInstall', locale),
    segments: terminalSegments(`$ comfy build init
✔ Scanned this ComfyUI install — custom nodes, models, pinned deps
$ comfy build push --release --target linux/nvidia
✔ Build released
$ comfy deploy up
✔ Endpoint live → https://your-build.run.comfy.app`)
  },
  workflow: {
    name: t('platform.serverlessDeploy.tabWorkflow', locale),
    segments:
      terminalSegments(`$ comfy build init --from-workflow ./workflow.json --comfy-version v0.34.2
✔ Custom nodes and models resolved from your workflow
$ comfy build push --release --target linux/nvidia
✔ Build released
$ comfy deploy up
✔ Endpoint live → https://your-build.run.comfy.app`)
  }
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-10 pb-4 lg:pt-14 lg:pb-6">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessDeploy.shipHeading', locale) }}
      <template #subtitle>
        <p
          class="mx-auto mt-4 max-w-2xl text-sm whitespace-pre-line text-smoke-700"
        >
          {{ t('platform.serverlessDeploy.shipSubtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 max-w-3xl">
      <CodeTabs
        :tabs="deployTabs"
        :label="t('platform.serverlessDeploy.heading', locale)"
        content-class="bg-[#2a2230]"
        list-class="mx-auto sm:flex sm:w-fit"
        trigger-class="px-2"
      />
    </div>
  </section>
</template>
