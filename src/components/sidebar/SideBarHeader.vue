<template>
  <Toolbar class="comfy-vue-side-bar-header">
    <template #start>
      <span class="comfy-vue-side-bar-header-span">{{
        props.title.toUpperCase()
      }}</span>
    </template>
    <template #end>
      <slot name="tool-buttons"></slot>
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
import Toolbar from 'primevue/toolbar'

const props = defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.comfy-vue-side-bar-header {
  border-left: none;
  border-right: none;
  border-top: none;
  border-radius: 0;
  padding: 0.25rem 1rem;
}
.comfy-vue-side-bar-header-span {
  font-size: small;
}
</style>
