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
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[radial-gradient(ellipse_92%_84%_at_72%_50%,black_0%,black_58%,transparent_100%)] opacity-35 filter-[grayscale(1)_contrast(1.15)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
