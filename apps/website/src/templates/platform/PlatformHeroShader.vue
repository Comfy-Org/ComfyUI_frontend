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
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[radial-gradient(ellipse_92%_78%_at_70%_52%,black_0%,black_46%,transparent_100%)] opacity-40 filter-[grayscale(1)_contrast(1.15)] md:left-1/2 md:mask-[radial-gradient(ellipse_58%_82%_at_50%_48%,black_0%,black_48%,rgba(0,0,0,0.72)_66%,transparent_90%)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
