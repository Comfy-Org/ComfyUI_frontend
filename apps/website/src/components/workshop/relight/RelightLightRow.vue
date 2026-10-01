<script setup lang="ts">
import { Copy, Eye, EyeOff, Trash2 } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import EditorIconButton from '../app-editor/EditorIconButton.vue'

const {
  light,
  selected,
  canDuplicate,
  locale = 'en'
} = defineProps<{
  light: Light
  selected: boolean
  canDuplicate: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  select: []
  toggle: []
  duplicate: []
  remove: []
}>()
</script>

<template>
  <li
    :class="
      cn(
        'flex h-10 items-center gap-0.5 rounded-lg border border-l-3 border-transparent pr-1 pl-2 transition',
        selected
          ? 'border-primary-comfy-yellow/40 bg-transparency-white-t8'
          : 'hover:bg-transparency-white-t4'
      )
    "
    :style="{ borderLeftColor: selected ? light.color : 'transparent' }"
  >
    <button
      type="button"
      :aria-pressed="selected"
      :class="
        cn(
          'flex h-full min-w-0 flex-1 items-center gap-2 text-left text-xs text-primary-warm-white focus-visible:outline-none',
          !light.visible && 'opacity-50'
        )
      "
      @click="emit('select')"
    >
      <span
        :class="
          cn(
            'size-3.5 shrink-0 rounded-full border border-primary-comfy-ink-light',
            selected && 'ring-2 ring-primary-warm-white/70'
          )
        "
        :style="{ backgroundColor: light.color }"
        aria-hidden="true"
      />
      <span :class="cn('flex-1 truncate', selected && 'font-medium')">{{
        light.name
      }}</span>
      <span class="text-[10px] text-primary-warm-gray">{{
        lc(
          light.kind === 'point'
            ? 'relight.kind.point'
            : 'relight.kind.directional',
          locale
        )
      }}</span>
    </button>
    <EditorIconButton
      :icon="light.visible ? Eye : EyeOff"
      :label="
        lc(
          light.visible ? 'relight.light.hide' : 'relight.light.show',
          locale,
          {
            name: light.name
          }
        )
      "
      @click="emit('toggle')"
    />
    <EditorIconButton
      :icon="Copy"
      :label="lc('relight.light.duplicate', locale, { name: light.name })"
      :disabled="!canDuplicate"
      @click="emit('duplicate')"
    />
    <EditorIconButton
      :icon="Trash2"
      :label="lc('relight.light.remove', locale, { name: light.name })"
      @click="emit('remove')"
    />
  </li>
</template>
