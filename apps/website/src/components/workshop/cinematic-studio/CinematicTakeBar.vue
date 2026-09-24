<script setup lang="ts">
import { Download } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  current,
  siblings,
  modelName,
  locale = 'en'
} = defineProps<{
  current: Take
  siblings: readonly Take[]
  modelName: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <div
    class="flex max-w-full items-center gap-2.5 rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink/90 py-1.5 pr-1.5 pl-4 backdrop-blur-sm"
  >
    <span class="text-[15px] font-semibold text-primary-warm-white">
      {{
        tc('cinematic.stage.shot', locale).replace(
          '{number}',
          String(current.shot)
        )
      }}
    </span>
    <div
      v-if="siblings.length > 1"
      role="radiogroup"
      :aria-label="tc('cinematic.stage.takes', locale)"
      class="flex gap-1"
    >
      <button
        v-for="take in siblings"
        :key="take.id"
        type="button"
        role="radio"
        :aria-checked="take.id === current.id"
        :class="
          cn(
            'grid size-6 place-items-center rounded-md text-xs font-medium',
            take.id === current.id
              ? 'bg-primary-warm-white text-primary-comfy-ink'
              : 'text-primary-warm-gray hover:bg-transparency-white-t8'
          )
        "
        @click="emit('select', take.id)"
      >
        {{ take.letter }}
      </button>
    </div>
    <span class="truncate text-sm text-primary-warm-gray">
      {{ modelName }} · {{ current.aspect }}
    </span>
    <span class="h-5 w-px bg-transparency-white-t8" aria-hidden="true" />
    <a
      v-if="current.status === 'done'"
      :href="current.output.url"
      :download="current.output.fileName"
      class="grid size-9 place-items-center rounded-lg text-primary-comfy-canvas hover:bg-transparency-white-t8"
      :aria-label="tc('cinematic.stage.download', locale)"
    >
      <Download class="size-4" aria-hidden="true" />
    </a>
  </div>
</template>
