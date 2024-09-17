<template>
  <div class="model_preview">
    <div class="model_preview_title">
      {{ modelDef.title }}
    </div>
    <div class="model_preview_descript">
      {{ modelDef.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ComfyModelDef } from '@/stores/modelStore'

const props = defineProps({
  modelDef: {
    type: ComfyModelDef,
    required: true
  }
})

const modelDef = props.modelDef
</script>
<style scoped>
.model_preview {
  background-color: var(--comfy-menu-bg);
  font-family: 'Open Sans', sans-serif;
  font-size: small;
  color: var(--descrip-text);
  border: 1px solid var(--descrip-text);
  min-width: 300px;
  width: min-content;
  height: fit-content;
  z-index: 9999;
  border-radius: 12px;
  overflow: hidden;
  font-size: 12px;
  padding-bottom: 10px;
}
</style>
