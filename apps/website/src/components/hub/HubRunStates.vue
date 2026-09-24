<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { RUN_SCENES } from '../../lib/hub/run-scenes'
import WorkflowRunResult from './WorkflowRunResult.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const scenes = RUN_SCENES

const missing = [
  'The named reasons a run is refused, told apart on a model page by the field that caused them: a file the page could read but the model would not.',
  'What a failed run actually said. Cloud returns the node and the exception; none of it is shown, because none of it is written for a reader.'
]
</script>

<template>
  <div class="flex flex-col gap-16">
    <header class="flex max-w-2xl flex-col gap-4">
      <p
        class="text-sm leading-none font-medium tracking-widest text-primary-comfy-yellow uppercase"
      >
        Reference
      </p>
      <h1 class="text-3xl font-bold text-primary-comfy-canvas lg:text-4xl">
        Every state a run passes through
      </h1>
      <p class="text-sm/relaxed text-primary-warm-gray">
        The real output panel, handed each state in turn. Nothing here runs,
        uploads or costs anything.
      </p>
    </header>

    <!-- The panel keeps the width it has on a workflow page, so what is read
      here is the thing itself rather than a wider copy of it. -->
    <section
      v-for="scene in scenes"
      :key="scene.name"
      class="grid gap-x-8 gap-y-4 lg:grid-cols-12"
      data-testid="run-state-scene"
    >
      <WorkflowRunResult
        :state="scene.state"
        :outputs="scene.outputs ?? []"
        :sample="scene.sample"
        :cold-start="scene.coldStart ?? false"
        :member-workspace="scene.memberWorkspace"
        :locale
      />
      <div class="flex flex-col gap-1 lg:col-span-5 lg:pt-3">
        <h2 class="text-lg font-bold text-primary-comfy-canvas">
          {{ scene.name }}
        </h2>
        <p class="text-sm/relaxed text-primary-warm-gray">{{ scene.when }}</p>
      </div>
    </section>

    <section class="flex max-w-2xl flex-col gap-3">
      <h2 class="text-lg font-bold text-primary-comfy-canvas">Not drawn yet</h2>
      <p class="text-sm/relaxed text-primary-warm-gray">
        Everything a run can be is above. What is left is detail a model's
        playground carries and this one does not.
      </p>
      <ul
        class="flex list-disc flex-col gap-2 ps-5 text-sm/relaxed text-primary-warm-gray"
      >
        <li v-for="gap in missing" :key="gap">{{ gap }}</li>
      </ul>
      <p class="text-sm/relaxed text-primary-warm-gray">
        The input panel's own states — Sign in when nobody is signed in, Cancel
        while a run is going, and the empty wallet asked about before the run
        rather than after it — sit beside the form on a real workflow page
        rather than here.
      </p>
    </section>
  </div>
</template>
