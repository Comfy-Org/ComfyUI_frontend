<template>
  <div
    class="content-divider bg-border"
    :class="{
      'content-divider--horizontal': orientation === 'horizontal',
      'content-divider--vertical': orientation === 'vertical'
    }"
  />
</template>

<script setup lang="ts">
const { orientation = 'horizontal', width = 0.3 } = defineProps<{
  orientation?: 'horizontal' | 'vertical'
  width?: number
}>()
</script>

<style scoped>
.content-divider {
  display: inline-block;
  margin: 0;
  padding: 0;
  border: none;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.content-divider--horizontal {
  width: 100%;
  height: v-bind('width + "px"');
}

.content-divider--vertical {
  height: 100%;
  width: v-bind('width + "px"');
}
</style>
