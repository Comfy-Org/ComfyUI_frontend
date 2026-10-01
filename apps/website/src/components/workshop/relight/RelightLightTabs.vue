<script setup lang="ts">
import {
  Copy,
  Eye,
  EyeOff,
  Lightbulb,
  MoreHorizontal,
  Sun,
  Trash2
} from '@lucide/vue'
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import EditorMenuButton from '../app-editor/EditorMenuButton.vue'

const {
  relight,
  ids,
  locale = 'en'
} = defineProps<{
  relight: Relight
  /** Ids for each light's tab and the panel it controls. */
  ids: { tab: (id: string) => string; panel: string }
  locale?: Locale
}>()

const { lights, selected, full, phase } = relight
const strip = useTemplateRef<HTMLElement>('strip')

const kinds = [
  { id: 'point', label: lc('relight.kind.point', locale), icon: Lightbulb },
  {
    id: 'directional',
    label: lc('relight.kind.directional', locale),
    icon: Sun
  }
] as const

function actions(light: Light) {
  return [
    {
      id: 'toggle',
      label: lc(
        light.visible ? 'relight.light.hide' : 'relight.light.show',
        locale,
        {
          name: light.name
        }
      ),
      icon: light.visible ? EyeOff : Eye
    },
    {
      id: 'duplicate',
      label: lc('relight.light.duplicate', locale, { name: light.name }),
      icon: Copy,
      disabled: full.value
    },
    {
      id: 'remove',
      label: lc('relight.light.remove', locale, { name: light.name }),
      icon: Trash2
    }
  ] as const
}

function act(light: Light, id: 'toggle' | 'duplicate' | 'remove') {
  if (id === 'toggle')
    relight.updateLight(light.id, { visible: !light.visible })
  else if (id === 'duplicate') relight.duplicateLight(light.id)
  else relight.removeLight(light.id)
}

function step(event: KeyboardEvent) {
  const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
  if (!move || !lights.value.length) return
  event.preventDefault()
  const at = lights.value.findIndex((light) => light.id === selected.value)
  const next =
    lights.value[(at + move + lights.value.length) % lights.value.length]
  selected.value = next.id
  strip.value?.querySelector<HTMLElement>(`[data-light="${next.id}"]`)?.focus()
}
</script>

<template>
  <div ref="strip" class="relative flex items-start gap-1.5 px-1">
    <div
      role="tablist"
      :aria-label="lc('relight.lights', locale)"
      class="flex min-w-0 flex-1 flex-wrap gap-1.5"
      @keydown="step"
    >
      <div
        v-for="light in lights"
        :key="light.id"
        :class="
          cn(
            'flex h-8 max-w-full items-center rounded-full transition',
            light.id === selected
              ? 'bg-transparency-white-t20 text-primary-warm-white'
              : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
          )
        "
      >
        <button
          :id="ids.tab(light.id)"
          type="button"
          role="tab"
          :aria-controls="ids.panel"
          :data-light="light.id"
          :aria-selected="light.id === selected"
          :tabindex="light.id === selected ? 0 : -1"
          :class="
            cn(
              'flex h-full min-w-0 items-center gap-2 rounded-full pr-3 pl-2.5 text-xs focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
              light.id === selected && 'pr-1',
              !light.visible && 'text-primary-warm-gray line-through'
            )
          "
          @click="selected = light.id"
        >
          <span
            :class="
              cn(
                'size-2.5 shrink-0 rounded-full',
                !light.visible && 'opacity-40'
              )
            "
            :style="{ backgroundColor: light.color }"
            aria-hidden="true"
          />
          <span class="max-w-28 truncate">{{ light.name }}</span>
          <span class="sr-only">{{
            lc(
              light.kind === 'point'
                ? 'relight.kind.point'
                : 'relight.kind.directional',
              locale
            )
          }}</span>
        </button>
        <EditorMenuButton
          v-if="light.id === selected"
          :label="lc('relight.light.more', locale, { name: light.name })"
          :items="actions(light)"
          :icon="MoreHorizontal"
          icon-only
          detached
          end
          @pick="(id) => act(light, id)"
        />
      </div>
    </div>
    <EditorMenuButton
      :label="lc('relight.tool.add', locale)"
      :items="kinds"
      :disabled="full || phase.kind === 'running'"
      icon-only
      detached
      end
      class="shrink-0 rounded-full bg-transparency-white-t4"
      @pick="relight.addLight"
    />
  </div>
</template>
