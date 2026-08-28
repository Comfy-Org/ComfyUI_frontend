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
    class="pointer-events-none absolute inset-0 z-0 overflow-hidden mask-[radial-gradient(ellipse_92%_78%_at_70%_52%,black_0%,black_46%,transparent_100%)] opacity-35 filter-[grayscale(1)_contrast(1.15)] md:mask-[radial-gradient(ellipse_40%_82%_at_78%_48%,black_0%,black_44%,rgba(0,0,0,0.7)_62%,transparent_82%)]"
  >
    <ShaderClient v-if="isMounted" class="size-full" />
  </div>
</template>
