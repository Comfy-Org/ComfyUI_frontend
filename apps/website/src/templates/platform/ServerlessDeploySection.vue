<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CodeTab } from './CodeTabs.vue'
import CodeTabs from './CodeTabs.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Command surface from comfy-cli's build + deploy stack (PRs #801-805):
// `comfy build init --from-snapshot/--from-workflow`, `build push`, and
// `deploy up`, which defaults to the current directory.
const deployTabs: Record<string, CodeTab> = {
  install: {
    name: t('platform.serverlessDeploy.tabInstall', locale),
    segments: [
      `$ comfy build init --from-snapshot
✔ Imported your install — custom nodes, models, pinned deps
$ comfy build push
✔ Build released
$ comfy deploy up
✔ Endpoint live → https://your-build.run.comfy.app`
    ]
  },
  workflow: {
    name: t('platform.serverlessDeploy.tabWorkflow', locale),
    segments: [
      `$ comfy build init --from-workflow ./workflow.json
✔ Custom nodes and models resolved from your workflow
$ comfy build push
✔ Build released
$ comfy deploy up
✔ Endpoint live → https://your-build.run.comfy.app
$ comfy deploy run --workflow workflow_api.json
✔ Job complete — outputs downloaded to ./outputs`
    ]
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

    <div class="mx-auto mt-8 max-w-3xl">
      <CodeTabs
        :tabs="deployTabs"
        :aria-label="t('platform.serverlessDeploy.heading', locale)"
      />
    </div>
  </section>
</template>
