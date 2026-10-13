<script setup lang="ts">
import { ArrowRight, LoaderCircle } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

interface EditorExample {
  readonly id: string
  readonly image: string
  readonly label: string
  readonly result?: string
  readonly thumb?: string
}

/** The stage before anything is chosen: the frame the result will fill, holding examples to start from. */
const { title, hint, examples, loading } = defineProps<{
  title: string
  hint: string
  examples: readonly EditorExample[]
  loading?: string
}>()
const emit = defineEmits<{ example: [id: string] }>()
</script>

<template>
  <section
    class="my-auto flex w-full max-w-4xl flex-col gap-3 self-center rounded-2xl border border-dashed border-transparency-white-t20 p-4 sm:p-6"
  >
    <p class="text-sm text-primary-warm-white">
      {{ title }}
      <span class="text-primary-warm-gray">· {{ hint }}</span>
    </p>
    <ul :class="cn('grid gap-3', examples.length > 1 && 'sm:grid-cols-2')">
      <li v-for="example in examples" :key="example.id">
        <button
          type="button"
          :disabled="!!loading"
          :aria-busy="loading === example.id"
          :aria-label="example.label"
          class="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-transparency-white-t8 text-left transition hover:border-primary-warm-white/50 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:cursor-default"
          @click="emit('example', example.id)"
        >
          <img
            :src="example.image"
            alt=""
            loading="lazy"
            class="size-full object-cover transition group-hover:scale-[1.02]"
          />
          <img
            v-if="example.thumb"
            :src="example.thumb"
            alt=""
            loading="lazy"
            class="absolute top-2.5 right-2.5 aspect-3/4 w-1/6 rounded-md border border-primary-warm-white/70 object-cover shadow-lg"
          />
          <span
            class="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-primary-comfy-ink/90 to-transparent px-3.5 pt-8 pb-3 text-sm text-primary-warm-white"
          >
            {{ example.label }}
            <template v-if="example.result">
              <ArrowRight
                class="size-3.5 text-primary-warm-gray"
                aria-hidden="true"
              />
              {{ example.result }}
            </template>
          </span>
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
