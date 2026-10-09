<script setup lang="ts">
import { useNow } from '@vueuse/core'
import type { ComponentPublicInstance } from 'vue'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { useMapCorner } from '@/composables/useMapCorner'
import type { Relight, RelightImage } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { elapsedLabel } from '@/lib/workshop/elapsed'
import { lc } from '@/lib/workshop/relight/copy'
import EditorBusy from '@/components/workshop/app-editor/EditorBusy.vue'
import EditorHint from '@/components/workshop/app-editor/EditorHint.vue'
import { fittedSize } from '@/components/workshop/app-editor/stage-geometry'
import type { Light } from '@/lib/workshop/relight/lights'
import RelightLightMap from './RelightLightMap.vue'
import RelightStage from './RelightStage.vue'

const {
  image,
  relight,
  locale = 'en'
} = defineProps<{
  image: RelightImage
  relight: Relight
  locale?: Locale
}>()

const { setup, phase, comparing, lightMap, lightOnly, handles, selected, lit } =
  relight
const touched = ref(false)
watch(
  () => image.url,
  () => (touched.value = false)
)

function touch() {
  touched.value = true
}

function select(id: string) {
  selected.value = id
  touch()
}

function nudge(id: string, x: number, y: number) {
  touch()
  relight.updateLight(id, { x, y }, `nudge:${id}`)
}

function aim(id: string, patch: Partial<Light>) {
  touch()
  relight.updateLight(id, patch, `map:${id}`)
}

const showHandles = computed(
  () => handles.value && !comparing.value && phase.value.kind !== 'running'
)
const { corner: mapCorner, style: mapStyle } = useMapCorner(
  useTemplateRef<HTMLElement>('photo'),
  useTemplateRef<ComponentPublicInstance>('card'),
  () => (showHandles.value ? setup.value.lights : [])
)

const now = useNow({ interval: 1000 })
const elapsed = computed(() =>
  phase.value.kind === 'running'
    ? elapsedLabel(now.value.getTime() - phase.value.startedAt)
    : ''
)
</script>

<template>
  <div class="relative size-full">
    <RelightStage
      :image
      :lights="setup.lights"
      :masks="setup.masks"
      :scene="setup.scene"
      :selected
      :comparing
      :light-only="lightOnly && !comparing"
      :handles="showHandles"
      :locale
      @select="select"
      @begin="relight.checkpoint()"
      @place="(id, x, y) => relight.place(id, x, y)"
      @nudge="nudge"
    >
      <EditorHint
        v-if="!touched && !comparing && phase.kind === 'editing'"
        :text="lc('relight.hint', locale)"
      />
    </RelightStage>
    <div
      v-if="lightMap && !comparing && phase.kind === 'editing'"
      class="pointer-events-none absolute inset-0"
      style="container-type: size"
    >
      <div
        ref="photo"
        class="relative mx-auto"
        :style="fittedSize(image.width, image.height)"
      >
        <RelightLightMap
          ref="card"
          :lights="setup.lights"
          :selected
          :locale
          :data-corner="mapCorner"
          class="absolute ease-out motion-safe:transition-[left,top,translate] motion-safe:duration-300"
          :style="mapStyle"
          @select="select"
          @change="aim"
          @hide="lightMap = false"
        />
      </div>
    </div>
    <EditorBusy
      v-if="phase.kind === 'running'"
      :title="lc('relight.busy.title', locale)"
      :detail="
        lc('relight.busy.detail', locale, { n: lit.length, time: elapsed })
      "
      :cancel-label="lc('relight.cancel', locale)"
      @cancel="relight.cancel"
    />
  </div>
</template>
