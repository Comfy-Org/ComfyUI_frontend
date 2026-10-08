<script setup lang="ts">
import { Film, UserRound } from '@lucide/vue'
import { ref, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { kind, src, name, detail, heading, drop, hint, change, edit } =
  defineProps<{
    kind: 'video' | 'image'
    /** The chosen file's object URL; without one the slot asks for a file. */
    src?: string
    name?: string
    detail?: string
    heading: string
    drop: string
    hint: string
    change: string
    /** A second action on the chosen file, such as Trim; omitted when there is none. */
    edit?: string
  }>()

const emit = defineEmits<{ pick: [file: File]; edit: [] }>()

const over = ref(false)
const headingId = useId()

function choose(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('pick', file)
}

function dropped(event: DragEvent) {
  over.value = false
  const file = event.dataTransfer?.files[0]
  if (file?.type.startsWith(`${kind}/`)) emit('pick', file)
}
</script>

<template>
  <section :aria-labelledby="headingId" class="flex flex-col gap-2">
    <h2
      :id="headingId"
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ heading }}
    </h2>
    <div
      v-if="src"
      class="flex items-center gap-3 rounded-2xl border border-transparency-white-t8 p-2.5"
      :data-testid="`openjutsu-${kind}-chosen`"
    >
      <video
        v-if="kind === 'video'"
        :src
        muted
        playsinline
        preload="metadata"
        class="aspect-video w-16 shrink-0 rounded-md bg-primary-comfy-ink object-contain"
      />
      <img
        v-else
        :src
        alt=""
        class="size-12 shrink-0 rounded-md bg-primary-comfy-ink object-contain"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold text-primary-warm-white">
          {{ name }}
        </span>
        <span v-if="detail" class="truncate text-xs text-primary-warm-gray">
          {{ detail }}
        </span>
      </span>
      <button
        v-if="edit"
        type="button"
        class="flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-comfy-canvas outline-none hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50"
        :data-testid="`openjutsu-${kind}-edit`"
        @click="emit('edit')"
      >
        {{ edit }}
      </button>
      <label
        class="flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-transparency-white-t8 px-3 text-xs text-primary-comfy-canvas focus-within:ring-2 focus-within:ring-primary-comfy-yellow/50 hover:text-primary-warm-white"
      >
        {{ change }}
        <input
          type="file"
          :accept="`${kind}/*`"
          class="sr-only"
          @change="choose"
        />
      </label>
    </div>
    <label
      v-else
      :class="
        cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-transparency-white-t20 bg-transparency-white-t4 px-4 py-4 transition-colors focus-within:border-primary-comfy-yellow hover:border-primary-warm-white/40',
          over && 'border-primary-comfy-yellow bg-transparency-white-t8'
        )
      "
      :data-testid="`openjutsu-${kind}-drop`"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="dropped"
    >
      <span
        class="grid size-10 shrink-0 place-items-center rounded-full bg-transparency-white-t8 text-primary-comfy-canvas"
      >
        <component
          :is="kind === 'video' ? Film : UserRound"
          class="size-5"
          aria-hidden="true"
        />
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="text-sm font-semibold text-primary-warm-white">
          {{ drop }}
        </span>
        <span class="text-xs/relaxed text-primary-warm-gray">{{ hint }}</span>
      </span>
      <input
        type="file"
        :accept="`${kind}/*`"
        class="sr-only"
        @change="choose"
      />
    </label>
  </section>
</template>
