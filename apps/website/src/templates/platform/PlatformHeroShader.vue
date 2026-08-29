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
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[radial-gradient(ellipse_96%_84%_at_70%_52%,black_0%,black_54%,transparent_100%)] opacity-50 filter-[grayscale(1)_contrast(1.15)] md:left-[42%] md:mask-[radial-gradient(ellipse_74%_92%_at_50%_48%,black_0%,black_58%,rgba(0,0,0,0.82)_78%,transparent_100%)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
