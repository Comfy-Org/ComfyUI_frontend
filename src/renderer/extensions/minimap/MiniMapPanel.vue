<template>
  <div
    class="minimap-panel p-3 mr-2 flex flex-col gap-3 text-sm"
    :style="panelStyles"
  >
    <div class="flex items-center gap-2">
      <Checkbox
        input-id="node-colors"
        name="node-colors"
        :model-value="nodeColors"
        binary
        @update:model-value="
          (value) => $emit('updateOption', 'Comfy.Minimap.NodeColors', value)
        "
      />
      <i-lucide:palette />
      <label for="node-colors">{{ $t('minimap.nodeColors') }}</label>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        input-id="show-links"
        name="show-links"
        :model-value="showLinks"
        binary
        @update:model-value="
          (value) => $emit('updateOption', 'Comfy.Minimap.ShowLinks', value)
        "
      />
      <i-lucide:route />
      <label for="show-links">{{ $t('minimap.showLinks') }}</label>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        input-id="show-groups"
        name="show-groups"
        :model-value="showGroups"
        binary
        @update:model-value="
          (value) => $emit('updateOption', 'Comfy.Minimap.ShowGroups', value)
        "
      />
      <i-lucide:frame />
      <label for="show-groups">{{ $t('minimap.showGroups') }}</label>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        input-id="render-bypass"
        name="render-bypass"
        :model-value="renderBypass"
        binary
        @update:model-value="
          (value) =>
            $emit('updateOption', 'Comfy.Minimap.RenderBypassState', value)
        "
      />
      <i-lucide:circle-slash-2 />
      <label for="render-bypass">{{ $t('minimap.renderBypassState') }}</label>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        input-id="render-error"
        name="render-error"
        :model-value="renderError"
        binary
        @update:model-value="
          (value) =>
            $emit('updateOption', 'Comfy.Minimap.RenderErrorState', value)
        "
      />
      <i-lucide:message-circle-warning />
      <label for="render-error">{{ $t('minimap.renderErrorState') }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'

import type { MinimapSettingsKey } from '@/renderer/extensions/minimap/types'

defineProps<{
  panelStyles: any
  nodeColors: boolean
  showLinks: boolean
  showGroups: boolean
  renderBypass: boolean
  renderError: boolean
}>()

defineEmits<{
  updateOption: [key: MinimapSettingsKey, value: boolean]
}>()
</script>
