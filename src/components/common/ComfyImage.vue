<!-- A image with placeholder fallback on error -->
<template>
  <img
    :src="src"
    @error="handleImageError"
    :class="[{ 'broken-image': imageBroken }, ...classArray]"
  />
  <div v-if="imageBroken" class="broken-image-placeholder">
    <i class="pi pi-image"></i>
    <span>{{ $t('imageFailedToLoad') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  src: string
  class?: string | string[] | object
}>()

const imageBroken = ref(false)
const handleImageError = () => {
  imageBroken.value = true
}

const classArray = computed(() => {
  if (Array.isArray(props.class)) {
    return props.class
  } else if (typeof props.class === 'string') {
    return props.class.split(' ')
  } else if (typeof props.class === 'object') {
    return Object.keys(props.class).filter((key) => props.class[key])
  }
  return []
})
</script>

<style scoped>
.broken-image {
  display: none;
}

.broken-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.broken-image-placeholder i {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}
</style>
