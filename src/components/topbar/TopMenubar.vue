<template>
  <teleport to=".comfyui-body-top">
    <div class="top-menubar comfyui-menu">
      <h1 class="comfyui-logo mx-2">ComfyUI</h1>
      <Menubar :model="items" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Menubar from 'primevue/menubar'

const items = [
  {
    label: 'File',
    items: [
      { label: 'New', icon: 'pi pi-plus' },
      { label: 'Open', icon: 'pi pi-download' }
    ]
  }
]
</script>

<style scoped>
.comfyui-menu {
  width: 100vw;
  background: var(--comfy-menu-bg);
  color: var(--fg-color);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  z-index: 1000;
  order: 0;
  grid-column: 1/-1;
  overflow: auto;
  max-height: 90vh;
}

.comfyui-logo {
  font-size: 1.2em;
  user-select: none;
  cursor: default;
}
</style>
