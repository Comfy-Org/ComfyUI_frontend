<script setup lang="ts">
import { useReshootDemo } from '../../../../composables/useReshootDemo'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import { t } from '../../../../i18n/translations'
import AppsBackLink from '../AppsBackLink.vue'
import ReshootPanel from './ReshootPanel.vue'
import ReshootStage from './ReshootStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const {
  upload,
  clip,
  clipName,
  isExample,
  aspect,
  size,
  depth,
  step,
  camera,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  seed,
  takes,
  selected,
  current,
  rendering,
  prepare,
  back,
  generate,
  cancel,
  aim,
  addKey,
  removeKey
} = useReshootDemo()

function go(target: 1 | 2) {
  if (target === 1) back()
  else prepare()
}
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-4 py-8 sm:px-8 lg:px-14"
    data-testid="reshoot"
  >
    <AppsBackLink :locale class="mb-3" />
    <div class="mb-6 flex items-center gap-3">
      <h1 class="text-2xl font-semibold text-primary-warm-white lg:text-3xl">
        {{ rc('reshoot.title', locale) }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ rc('reshoot.prototype', locale) }}
      </span>
      <span class="text-xs text-primary-warm-gray max-sm:hidden">
        {{ rc('reshoot.credit', locale) }}
      </span>
    </div>
    <div class="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <ReshootPanel
        v-model:upload="upload"
        v-model:aspect="aspect"
        v-model:size="size"
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:motion="motion"
        v-model:prompt="prompt"
        v-model:seed="seed"
        :clip
        :clip-name="clipName"
        :is-example="isExample"
        :camera
        :keys
        :depth
        :step
        :rendering
        :locale
        class="lg:col-span-5"
        @aim="aim"
        @key="addKey"
        @remove-key="removeKey"
        @clear-keys="keys = []"
        @go="go"
        @prepare="prepare"
        @generate="generate"
        @cancel="cancel"
      />
      <section
        class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
      >
        <header
          class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
        >
          {{ t('workshop.output.title', locale) }}
        </header>
        <div class="p-4 sm:p-6">
          <ReshootStage
            :clip
            :camera
            :depth
            :step
            :takes
            :selected
            :current
            :locale
            @aim="aim"
            @select="selected = $event"
          />
        </div>
      </section>
    </div>
  </div>
</template>
