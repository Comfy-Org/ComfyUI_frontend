<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'

/** One ready-made start: a picture of it and its name. */
interface EditorExample {
  readonly id: string
  readonly image: string
  readonly label: string
}

/**
 * The stage before anything is chosen: examples to start from. Uploading lives
 * in the panel, so the stage offers no upload of its own.
 */
const { title, hint, examples, loading } = defineProps<{
  title: string
  hint: string
  examples: readonly EditorExample[]
  /** The example being fetched. */
  loading?: string
}>()
const emit = defineEmits<{ example: [id: string] }>()
</script>

<template>
  <section class="my-auto flex w-full max-w-4xl flex-col gap-4 self-center">
    <div class="flex flex-col gap-1">
      <h2 class="text-base font-medium text-primary-warm-white">
        {{ title }}
      </h2>
      <p class="text-sm text-primary-warm-gray">{{ hint }}</p>
    </div>
    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <li v-for="example in examples" :key="example.id">
        <button
          type="button"
          :disabled="!!loading"
          :aria-busy="loading === example.id"
          class="group flex w-full cursor-pointer flex-col gap-2 text-left focus-visible:outline-none disabled:cursor-default"
          @click="emit('example', example.id)"
        >
          <span
            class="relative block aspect-video overflow-hidden rounded-xl border border-transparency-white-t8 transition group-hover:border-primary-warm-white/50 group-focus-visible:ring-3 group-focus-visible:ring-primary-comfy-yellow/50"
          >
            <img
              :src="example.image"
              alt=""
              loading="lazy"
              class="size-full object-cover"
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
          </span>
          <span class="text-sm text-primary-warm-white">{{
            example.label
          }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
