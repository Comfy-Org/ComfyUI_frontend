<script setup lang="ts">
import { ref, watch } from 'vue'

const {
  src,
  alt,
  label,
  filter,
  dot = false
} = defineProps<{
  src: string
  alt: string
  label?: string
  filter?: string
  dot?: boolean
}>()

/** The rendered source trails the prop by one decode: the next image is
 * fetched and decoded off-screen first, then crossfaded in over the current
 * frame, so a swap never flashes blank or tears. */
const displayed = ref(src)

watch(
  () => src,
  (next) => {
    const loader = new Image()
    loader.src = next
    const apply = () => {
      // Drop stale decodes: only the latest requested source may land.
      if (src === next) displayed.value = next
    }
    loader.decode().then(apply, apply)
  }
)
</script>

<template>
  <div
    class="relative size-full overflow-hidden rounded-[1.25em] border border-white/12 bg-black/40"
  >
    <Transition name="herofade">
      <img
        :key="displayed"
        :src="displayed"
        :alt
        :style="{ filter }"
        draggable="false"
        class="absolute inset-0 size-full object-cover select-none"
        decoding="async"
      />
    </Transition>

    <!-- Wire anchor; its centre must match PORTS.inputOut in graphLayout.ts -->
    <span
      v-if="dot"
      class="bg-primary-comfy-yellow absolute top-[1.325em] right-[1.225em] size-[0.55em] rounded-full"
    />

    <span
      v-if="label"
      class="bg-secondary-deep-plum absolute top-[1em] left-[1em] z-10 flex items-center gap-[0.5em] rounded-[0.5em] px-[0.9em] py-[0.45em]"
    >
      <span class="bg-primary-comfy-yellow size-[0.5em] rounded-full" />
      <span
        class="text-primary-comfy-yellow ppformula-text-center font-formula text-[0.75em] leading-[1.1] font-bold tracking-[-0.01em]"
      >
        {{ label }}
      </span>
    </span>
  </div>
</template>

<style scoped>
.herofade-enter-active,
.herofade-leave-active {
  transition: opacity 120ms linear;
}

.herofade-enter-from,
.herofade-leave-to {
  opacity: 0;
}
</style>
