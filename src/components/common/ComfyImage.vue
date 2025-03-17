<!-- A image with placeholder fallback on error -->
<template>
  <span
    v-if="!imageBroken"
    class="comfy-image-wrap"
    :class="[{ contain: contain }]"
  >
    <img
      v-if="contain"
      :src="src"
      @error="handleImageError"
      :data-test="src"
      class="comfy-image-blur"
      :style="{ 'background-image': `url(${src})` }"
      :alt="alt"
    />
    <img
      :src="src"
      @error="handleImageError"
      class="comfy-image-main"
      :class="[...classArray]"
      :alt="alt"
    />
  </span>
  <div v-if="imageBroken" class="broken-image-placeholder">
    <i class="pi pi-image"></i>
    <span>{{ $t('g.imageFailedToLoad') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    class?: string | string[] | object
    contain: boolean
    alt?: string
  }>(),
  {
    contain: false,
    alt: 'Image content'
  }
)

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
.comfy-image-wrap {
  display: contents;
}

.comfy-image-blur {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comfy-image-main {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  z-index: 1;
}

.contain .comfy-image-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.contain .comfy-image-main {
  object-fit: contain;
  backdrop-filter: blur(10px);
  position: absolute;
}

.broken-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 2rem;
}

.broken-image-placeholder i {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}
</style>
