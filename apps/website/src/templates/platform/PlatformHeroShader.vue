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
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[radial-gradient(ellipse_100%_92%_at_64%_52%,black_0%,black_54%,rgba(0,0,0,0.7)_74%,transparent_100%)] opacity-50 filter-[grayscale(1)_contrast(1.15)] md:-bottom-48 md:left-0 md:mask-[radial-gradient(ellipse_90%_84%_at_54%_42%,black_0%,black_46%,rgba(0,0,0,0.56)_64%,transparent_92%)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
