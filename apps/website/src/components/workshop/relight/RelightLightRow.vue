<script setup lang="ts">
import { Copy, Eye, EyeOff, Lightbulb, Sun, Trash2 } from '@lucide/vue'

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
  <li class="flex flex-col">
    <div
      :class="
        cn(
          'group flex h-9 items-center gap-0.5 rounded-lg pr-0.5 pl-2 transition',
          selected
            ? 'bg-transparency-white-t8'
            : 'hover:bg-transparency-white-t4'
        )
      "
    >
      <button
        type="button"
        :aria-pressed="selected"
        :class="
          cn(
            'flex h-full min-w-0 flex-1 items-center gap-2.5 text-left text-xs text-primary-warm-gray focus-visible:outline-none',
            selected && 'text-primary-warm-white',
            !light.visible && 'opacity-50'
          )
        "
        @click="emit('select')"
      >
        <span
          :class="
            cn(
              'size-2.5 shrink-0 rounded-full',
              selected &&
                'ring-2 ring-primary-warm-white/40 ring-offset-1 ring-offset-primary-comfy-ink-light'
            )
          "
          :style="{ backgroundColor: light.color }"
          aria-hidden="true"
        />
        <span class="flex-1 truncate">{{ light.name }}</span>
        <component
          :is="light.kind === 'point' ? Lightbulb : Sun"
          class="size-3 shrink-0 text-primary-warm-gray"
          aria-hidden="true"
        />
        <span class="sr-only">{{
          lc(
            light.kind === 'point'
              ? 'relight.kind.point'
              : 'relight.kind.directional',
            locale
          )
        }}</span>
      </button>
      <span
        :class="
          cn(
            'flex items-center opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100',
            selected && 'opacity-100'
          )
        "
      >
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
      </span>
    </div>
    <slot />
  </li>
</template>
