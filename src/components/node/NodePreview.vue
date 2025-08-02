<!-- Reference:
https://github.com/Nuked88/ComfyUI-N-Sidebar/blob/7ae7da4a9761009fb6629bc04c683087a3e168db/app/js/functions/sb_fn.js#L149
-->

<template>
  <div class="_sb_node_preview">
    <div class="_sb_table">
      <div
        class="node_header"
        :style="{
          backgroundColor: litegraphColors.NODE_DEFAULT_COLOR,
          color: litegraphColors.NODE_TITLE_COLOR
        }"
      >
        <div class="_sb_dot headdot" />
        {{ nodeDef.display_name }}
      </div>
      <div class="_sb_preview_badge">PREVIEW</div>

      <!-- Node slot I/O -->
      <div
        v-for="[slotInput, slotOutput] in _.zip(slotInputDefs, allOutputDefs)"
        :key="(slotInput?.name || '') + (slotOutput?.index.toString() || '')"
        class="_sb_row slot_row"
      >
        <div class="_sb_col">
          <div v-if="slotInput" :class="['_sb_dot', slotInput.type]" />
        </div>
        <div class="_sb_col">
          {{ slotInput ? slotInput.name : '' }}
        </div>
        <div class="_sb_col middle-column" />
        <div
          class="_sb_col _sb_inherit"
          :style="{
            color: litegraphColors.NODE_TEXT_COLOR
          }"
        >
          {{ slotOutput ? slotOutput.name : '' }}
        </div>
        <div class="_sb_col">
          <div v-if="slotOutput" :class="['_sb_dot', slotOutput.type]" />
        </div>
      </div>

      <!-- Node widget inputs -->
      <div
        v-for="widgetInput in widgetInputDefs"
        :key="widgetInput.name"
        class="_sb_row _long_field"
      >
        <div class="_sb_col _sb_arrow">&#x25C0;</div>
        <div
          class="_sb_col"
          :style="{
            color: litegraphColors.WIDGET_SECONDARY_TEXT_COLOR
          }"
        >
          {{ widgetInput.name }}
        </div>
        <div class="_sb_col middle-column" />
        <div
          class="_sb_col _sb_inherit"
          :style="{ color: litegraphColors.WIDGET_TEXT_COLOR }"
        >
          {{ truncateDefaultValue(widgetInput.default) }}
        </div>
        <div class="_sb_col _sb_arrow">&#x25B6;</div>
      </div>
    </div>
    <div
      v-if="nodeDef.description"
      class="_sb_description"
      :style="{
        color: litegraphColors.WIDGET_SECONDARY_TEXT_COLOR,
        backgroundColor: litegraphColors.WIDGET_BGCOLOR
      }"
    >
      {{ nodeDef.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import _ from 'lodash'
import { computed } from 'vue'

import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const props = defineProps<{
  nodeDef: ComfyNodeDefV2
}>()

const colorPaletteStore = useColorPaletteStore()
const litegraphColors = computed(
  () => colorPaletteStore.completedActivePalette.colors.litegraph_base
)

const widgetStore = useWidgetStore()

const nodeDef = props.nodeDef
const allInputDefs = Object.values(nodeDef.inputs)
const allOutputDefs = nodeDef.outputs
const slotInputDefs = allInputDefs.filter(
  (input) => !widgetStore.inputIsWidget(input)
)
const widgetInputDefs = allInputDefs.filter((input) =>
  widgetStore.inputIsWidget(input)
)
const truncateDefaultValue = (value: any, charLimit: number = 32): string => {
  let stringValue: string

  if (typeof value === 'object' && value !== null) {
    stringValue = JSON.stringify(value)
  } else if (Array.isArray(value)) {
    stringValue = JSON.stringify(value)
  } else if (typeof value === 'string') {
    stringValue = value
  } else {
    stringValue = String(value)
  }

  return _.truncate(stringValue, { length: charLimit })
}
</script>

<style scoped>
.slot_row {
  padding: 2px;
}

/* Original N-Sidebar styles */
._sb_dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: grey;
}

.node_header {
  line-height: 1;
  padding: 8px 13px 7px;
  margin-bottom: 5px;
  font-size: 15px;
  text-wrap: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.headdot {
  width: 10px;
  height: 10px;
  float: inline-start;
  margin-right: 8px;
}

.IMAGE {
  background-color: #64b5f6;
}

.VAE {
  background-color: #ff6e6e;
}

.LATENT {
  background-color: #ff9cf9;
}

.MASK {
  background-color: #81c784;
}

.CONDITIONING {
  background-color: #ffa931;
}

.CLIP {
  background-color: #ffd500;
}

.MODEL {
  background-color: #b39ddb;
}

.CONTROL_NET {
  background-color: #a5d6a7;
}

._sb_node_preview {
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

._sb_node_preview ._sb_description {
  margin: 10px;
  padding: 6px;
  background: var(--border-color);
  border-radius: 5px;
  font-style: italic;
  font-weight: 500;
  font-size: 0.9rem;
  word-break: break-word;
}

._sb_table {
  display: grid;

  grid-column-gap: 10px;
  /* Spazio tra le colonne */
  width: 100%;
  /* Imposta la larghezza della tabella al 100% del contenitore */
}

._sb_row {
  display: grid;
  grid-template-columns: 10px 1fr 1fr 1fr 10px;
  grid-column-gap: 10px;
  align-items: center;
  padding-left: 9px;
  padding-right: 9px;
}

._sb_row_string {
  grid-template-columns: 10px 1fr 1fr 10fr 1fr;
}

._sb_col {
  border: 0 solid #000;
  display: flex;
  align-items: flex-end;
  flex-direction: row-reverse;
  flex-wrap: nowrap;
  align-content: flex-start;
  justify-content: flex-end;
}

._sb_inherit {
  display: inherit;
}

._long_field {
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  margin: 5px 5px 0 5px;
  border-radius: 10px;
  line-height: 1.7;
  text-wrap: nowrap;
}

._sb_arrow {
  color: var(--fg-color);
}

._sb_preview_badge {
  text-align: center;
  background: var(--comfy-input-bg);
  font-weight: bold;
  color: var(--error-text);
}
</style>
