<template>
  <div class="comfy-vue-side-bar-container">
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
    <div class="comfy-vue-side-bar-body">
      <slot name="body"></slot>
    </div>
  </div>
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
.comfy-vue-side-bar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.comfy-vue-side-bar-header {
  flex-shrink: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  border-radius: 0;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
}

.comfy-vue-side-bar-header-span {
  font-size: small;
}

.comfy-vue-side-bar-body {
  flex-grow: 1;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.comfy-vue-side-bar-body::-webkit-scrollbar {
  width: 1px;
}

.comfy-vue-side-bar-body::-webkit-scrollbar-thumb {
  background-color: transparent;
}
</style>
