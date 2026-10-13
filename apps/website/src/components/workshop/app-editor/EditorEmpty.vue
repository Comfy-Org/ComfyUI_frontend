<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

interface EditorExample {
  readonly id: string
  readonly image: string
  readonly label: string
  readonly result?: string
  readonly thumb?: string
  readonly fit?: 'cover' | 'contain'
}

/** The stage before anything is chosen: a card of examples to start from. */
const { title, examples, loading } = defineProps<{
  title: string
  examples: readonly EditorExample[]
  loading?: string
}>()
const emit = defineEmits<{ example: [id: string] }>()

const exampleName = (example: EditorExample) =>
  example.result ? `${example.label} → ${example.result}` : example.label
</script>

<template>
  <section
    class="m-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/80 p-5 backdrop-blur-sm sm:gap-5 sm:p-7"
  >
    <h2 class="text-lg font-medium text-primary-warm-white sm:text-xl">
      {{ title }}
    </h2>
    <ul
      :class="cn('grid gap-2 sm:gap-3', examples.length > 1 && 'grid-cols-2')"
    >
      <li v-for="example in examples" :key="example.id">
        <button
          type="button"
          :disabled="!!loading"
          :aria-busy="loading === example.id"
          :aria-label="exampleName(example)"
          class="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-transparency-white-t8 transition hover:border-primary-warm-white/50 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:cursor-default"
          @click="emit('example', example.id)"
        >
          <img
            :src="example.image"
            alt=""
            loading="lazy"
            :class="
              cn(
                'size-full transition group-hover:scale-[1.02]',
                example.fit === 'contain' ? 'object-contain' : 'object-cover'
              )
            "
          />
          <img
            v-if="example.thumb"
            :src="example.thumb"
            alt=""
            loading="lazy"
            class="absolute top-2 right-2 aspect-3/4 w-1/5 rounded-md border border-primary-warm-white/70 object-cover shadow-lg"
          />
          <span
            v-if="loading === example.id"
            class="absolute inset-0 grid place-items-center bg-primary-comfy-ink/60"
          >
            <LoaderCircle
              class="size-6 text-primary-comfy-yellow motion-safe:animate-spin"
              aria-hidden="true"
            />
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
