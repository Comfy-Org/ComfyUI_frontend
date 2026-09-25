<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '../../../../composables/useReshootDemo'
import type {
  ReshootAspect,
  ReshootCamera,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootAimChips from './ReshootAimChips.vue'

const {
  clip,
  camera,
  keyCount,
  aspect,
  size,
  depth,
  rendering,
  clipOpen = false,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  keyCount: number
  aspect: ReshootAspect
  size: ReshootSize
  depth: DepthState
  rendering: boolean
  clipOpen?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  clip: []
  aim: []
  generate: []
  cancel: []
}>()

const prompt = defineModel<string>('prompt', { required: true })

const aspectLabel = computed(() =>
  aspect === 'source' ? rc('reshoot.aspect.source', locale) : aspect
)
</script>

<template>
  <div
    class="flex w-full flex-col overflow-hidden rounded-3xl border border-transparency-white-t8 bg-primary-comfy-ink-light shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
    role="group"
    :aria-label="rc('reshoot.composer', locale)"
  >
    <div class="flex items-start gap-2.5 px-4 pt-3.5 pb-3">
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="clipOpen"
        :aria-label="rc('reshoot.section.video', locale)"
        :class="
          cn(
            'size-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-transparency-white-t20',
            clipOpen && 'ring-primary-warm-white'
          )
        "
        @click="emit('clip')"
      >
        <video
          :src="clip"
          muted
          playsinline
          preload="metadata"
          class="size-full object-cover"
        />
      </button>
      <label for="reshoot-prompt" class="sr-only">
        {{ rc('reshoot.section.prompt', locale) }}
      </label>
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <textarea
          id="reshoot-prompt"
          v-model="prompt"
          rows="2"
          :placeholder="rc('reshoot.prompt.placeholder', locale)"
          aria-describedby="reshoot-prompt-dialogue"
          class="field-sizing-content max-h-40 min-h-11 resize-none bg-transparent pt-1.5 text-base/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        />
        <p
          id="reshoot-prompt-dialogue"
          class="text-[11px] text-primary-warm-gray"
        >
          {{ rc('reshoot.prompt.dialogue', locale) }}
        </p>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center gap-2 border-t border-transparency-white-t8 px-3 py-2.5"
    >
      <div
        class="-mx-1 scrollbar-hide flex min-w-0 flex-1 basis-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:basis-auto"
      >
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="clipOpen"
          :aria-label="`${rc('reshoot.section.format', locale)}: ${aspectLabel}, ${size}`"
          :class="
            cn(
              'flex h-9 shrink-0 items-center rounded-xl text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white',
              clipOpen &&
                'bg-transparency-white-t8 text-primary-warm-white ring-transparency-white-t20'
            )
          "
          @click="emit('clip')"
        >
          <span class="px-3">{{ aspectLabel }}</span>
          <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
          <span class="px-3">{{ size }}</span>
        </button>
        <ReshootAimChips
          :camera
          :key-count="keyCount"
          :depth
          :locale
          @aim="emit('aim')"
        />
      </div>
      <Button
        v-if="rendering"
        variant="outline"
        class="ml-auto shrink-0 rounded-full px-6"
        @click="emit('cancel')"
      >
        {{ rc('reshoot.cancel', locale) }}
      </Button>
      <Button
        v-else
        :disabled="depth !== 'ready'"
        class="ml-auto shrink-0 rounded-full px-6"
        data-testid="reshoot-action"
        @click="emit('generate')"
      >
        {{ rc('reshoot.generate', locale) }}
      </Button>
    </div>
  </div>
</template>
