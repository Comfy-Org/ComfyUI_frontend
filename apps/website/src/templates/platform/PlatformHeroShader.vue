<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue'

const ShaderClient = defineAsyncComponent(
  () => import('./PlatformHeroShaderClient.vue')
)

const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 -inset-y-20 z-0 overflow-hidden mask-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.55)_20%,black_38%,black_62%,rgba(0,0,0,0.55)_80%,transparent_100%)] opacity-45 filter-[grayscale(1)_contrast(1.1)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
