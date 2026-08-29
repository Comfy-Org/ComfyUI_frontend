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
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[radial-gradient(ellipse_100%_92%_at_64%_52%,black_0%,black_58%,transparent_100%)] opacity-50 filter-[grayscale(1)_contrast(1.15)] md:-bottom-32 md:left-[8%] md:mask-[radial-gradient(ellipse_94%_96%_at_52%_48%,black_0%,black_62%,rgba(0,0,0,0.86)_82%,transparent_100%)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
