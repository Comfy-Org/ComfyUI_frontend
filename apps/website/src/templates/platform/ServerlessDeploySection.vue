<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CodeTab } from './CodeTabs.vue'
import CodeTabs from './CodeTabs.vue'
import FeatureCard from './FeatureCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const stepNumbers = [1, 2, 3] as const

const steps = stepNumbers.map((number) => ({
  title: t(`platform.serverlessDeploy.${number}.title`, locale),
  description: t(`platform.serverlessDeploy.${number}.description`, locale)
}))

// Command surface from comfy-cli's build + deploy stack (PRs #801-805):
// `comfy build init --from-snapshot/--from-workflow`, `build push`, and
// `deploy up`, which defaults to the current directory.
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
    segments: terminalSegments(`$ comfy build init --from-snapshot
✔ Imported your install — custom nodes, models, pinned deps
$ comfy build push
✔ Build released
$ comfy deploy up
✔ Endpoint live → https://your-build.run.comfy.app`)
  },
  workflow: {
    name: t('platform.serverlessDeploy.tabWorkflow', locale),
    segments:
      terminalSegments(`$ comfy build init --from-workflow ./workflow.json
✔ Custom nodes and models resolved from your workflow
$ comfy build push
✔ Build released
$ comfy deploy up
✔ Endpoint live → https://your-build.run.comfy.app
$ comfy deploy run --workflow workflow_api.json
✔ Job complete — outputs downloaded to ./outputs`)
  }
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverlessDeploy.heading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.serverlessDeploy.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <ol class="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
      <li v-for="step in steps" :key="step.title">
        <FeatureCard
          class="h-full"
          :title="step.title"
          :description="step.description"
        />
      </li>
    </ol>

    <div class="mx-auto mt-8 max-w-3xl">
      <CodeTabs
        :tabs="deployTabs"
        :label="t('platform.serverlessDeploy.heading', locale)"
        content-class="bg-[#2a2230]"
        list-class="mx-auto sm:flex sm:w-fit"
      />
    </div>
  </section>
</template>
