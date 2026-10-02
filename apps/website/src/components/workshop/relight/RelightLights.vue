<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import RelightLightEditor from './RelightLightEditor.vue'
import RelightLightRow from './RelightLightRow.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { lights, selected } = relight
const id = useId()
const list = useTemplateRef<HTMLElement>('list')
const folded = ref(false)
watch(selected, () => (folded.value = false))
const expanded = computed(() => (folded.value ? undefined : selected.value))

function open(light: string) {
  if (light === selected.value) folded.value = !folded.value
  else selected.value = light
}

function step(event: KeyboardEvent) {
  const move = { ArrowUp: -1, ArrowDown: 1 }[event.key]
  const rows = [
    ...(list.value?.querySelectorAll<HTMLElement>('[data-light-row]') ?? [])
  ]
  const at = rows.findIndex((row) => row === event.target)
  if (!move || at < 0) return
  event.preventDefault()
  rows[(at + move + rows.length) % rows.length].focus()
}
</script>

<template>
  <ul
    v-if="lights.length"
    ref="list"
    :aria-label="lc('relight.lights', locale)"
    class="m-0 flex list-none flex-col gap-1 p-0"
    @keydown="step"
  >
    <li
      v-for="light in lights"
      :key="light.id"
      :class="
        cn(
          'rounded-xl transition-colors',
          light.id === expanded && 'bg-transparency-white-t4'
        )
      "
    >
      <RelightLightRow
        :light
        :selected="light.id === selected"
        :expanded="light.id === expanded"
        :controls="`${id}-${light.id}`"
        :locale
        @open="open(light.id)"
        @toggle="relight.updateLight(light.id, { visible: !light.visible })"
      />
      <RelightLightEditor
        v-if="light.id === expanded"
        :id="`${id}-${light.id}`"
        :relight
        :light
        :locale
      />
    </li>
  </ul>
  <p v-else class="px-1 text-xs text-primary-warm-gray">
    {{ lc('relight.lights.empty', locale) }}
  </p>
</template>
