<template>
  <div class="model_preview">
    <div class="model_preview_title">
      {{ initialModelDef.title }}
    </div>
    <div class="model_preview_top_container">
      <div class="model_preview_filename">
        {{ initialModelDef.file_name }}
      </div>
      <div
        v-if="initialModelDef.architecture_id"
        class="model_preview_architecture"
      >
        <span class="model_preview_prefix">{{ $t('g.architecture') }}: </span>
        {{ initialModelDef.architecture_id }}
      </div>
      <div v-if="initialModelDef.author" class="model_preview_author">
        <span class="model_preview_prefix">{{ $t('g.author') }}: </span>
        {{ initialModelDef.author }}
      </div>
    </div>
    <div v-if="initialModelDef.image" class="model_preview_image">
      <img :src="initialModelDef.image" />
    </div>
    <div v-if="initialModelDef.usage_hint" class="model_preview_usage_hint">
      <span class="model_preview_prefix">{{ $t('g.usageHint') }}: </span>
      {{ initialModelDef.usage_hint }}
    </div>
    <div
      v-if="initialModelDef.trigger_phrase"
      class="model_preview_trigger_phrase"
    >
      <span class="model_preview_prefix">{{ $t('g.triggerPhrase') }}: </span>
      {{ initialModelDef.trigger_phrase }}
    </div>
    <div v-if="initialModelDef.description" class="model_preview_description">
      <span class="model_preview_prefix">{{ $t('g.description') }}: </span>
      {{ initialModelDef.description }}
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

const initialModelDef = props.modelDef
</script>
<style scoped>
.model_preview {
  background-color: var(--background);
  color: var(--muted-foreground);
  border: 1px solid var(--muted-foreground);
  min-width: 300px;
  max-width: 500px;
  width: fit-content;
  height: fit-content;
  z-index: var(--z-index-overlay);
  border-radius: 12px;
  overflow: hidden;
  font-size: 12px;
  padding: 10px;
}
.model_preview_image {
  margin: auto;
  width: fit-content;
}
.model_preview_image img {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
}
.model_preview_title {
  font-weight: 700;
  text-align: center;
  font-size: 14px;
}
.model_preview_top_container {
  text-align: center;
  line-height: 0.5;
}
.model_preview_filename,
.model_preview_author,
.model_preview_architecture {
  display: inline-block;
  text-align: center;
  margin: 5px;
  font-size: var(--text-2xs);
}
.model_preview_prefix {
  font-weight: 700;
}
</style>
