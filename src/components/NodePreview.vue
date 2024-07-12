<!-- Reference:
https://github.com/Nuked88/ComfyUI-N-Sidebar/blob/7ae7da4a9761009fb6629bc04c683087a3e168db/app/js/functions/sb_fn.js#L149
-->

<template>
  <div id="previewDiv">
    <div class="sb_table">
      <div class="node_header">
        <div class="sb_dot headdot"></div>
        {{ nodeDef.display_name }}
      </div>
      <div class="sb_preview_badge">PREVIEW</div>

      <!-- Node slot I/O -->
      <div
        v-for="[slotInput, slotOutput] in _.zip(slotInputDefs, allOutputDefs)"
        class="sb_row slot_row"
      >
        <div class="sb_col">
          <div v-if="slotInput" :class="['sb_dot', slotInput.type]"></div>
        </div>
        <div class="sb_col">{{ slotInput ? slotInput.name : "" }}</div>
        <div class="sb_col middle-column"></div>
        <div class="sb_col sb_inherit">
          {{ slotOutput ? slotOutput.name : "" }}
        </div>
        <div class="sb_col">
          <div v-if="slotOutput" :class="['sb_dot', slotOutput.type]"></div>
        </div>
      </div>

      <!-- Node widget inputs -->
      <div v-for="widgetInput in widgetInputDefs" class="sb_row long_field">
        <div class="sb_col sb_arrow">&#x25C0;</div>
        <div class="sb_col">{{ widgetInput.name }}</div>
        <div class="sb_col middle-column"></div>
        <div class="sb_col sb_inherit">{{ widgetInput.defaultValue }}</div>
        <div class="sb_col sb_arrow">&#x25B6;</div>
      </div>
    </div>
    <div class="sb_description" v-if="nodeDef.description">
      {{ nodeDef.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { app } from "@/scripts/app";
import { type ComfyNodeDef } from "@/types/apiTypes";
import _ from "lodash";
import { PropType } from "vue";

const props = defineProps({
  nodeDef: {
    type: Object as PropType<ComfyNodeDef>,
    required: true,
  },
  // Make sure vue properly re-render the component when the nodeDef changes
  key: {
    type: String,
    required: true,
  },
});

const nodeDef = props.nodeDef as ComfyNodeDef;

// --------------------------------------------------
// TODO: Move out to separate file
interface IComfyNodeInputDef {
  name: string;
  type: string;
  widgetType: string | null;
  defaultValue: any;
}

interface IComfyNodeOutputDef {
  name: string | null;
  type: string;
  isList: boolean;
}

const allInputs = Object.assign(
  {},
  nodeDef.input.required || {},
  nodeDef.input.optional || {}
);
const allInputDefs: IComfyNodeInputDef[] = Object.entries(allInputs).map(
  ([inputName, inputData]) => {
    return {
      name: inputName,
      type: inputData[0],
      widgetType: app.getWidgetType(inputData, inputName),
      defaultValue:
        inputData[1]?.default ||
        (inputData[0] instanceof Array ? inputData[0][0] : ""),
    };
  }
);

const allOutputDefs: IComfyNodeOutputDef[] = _.zip(
  nodeDef.output,
  nodeDef.output_name || [],
  nodeDef.output_is_list || []
).map(([outputType, outputName, isList]) => {
  return {
    name: outputName,
    type: outputType instanceof Array ? "COMBO" : outputType,
    isList: isList,
  };
});

const slotInputDefs = allInputDefs.filter((input) => !input.widgetType);
const widgetInputDefs = allInputDefs.filter((input) => !!input.widgetType);
</script>

<style scoped>
.slot_row {
  padding: 2px;
}

/* Original N-SideBar styles */
.sb_dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: grey;
}

.node_header {
  line-height: 1;
  padding: 8px 13px 7px;
  background: var(--comfy-input-bg);
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

#previewDiv {
  background-color: var(--comfy-menu-bg);
  font-family: "Open Sans", sans-serif;
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

#previewDiv .sb_description {
  margin: 10px;
  padding: 6px;
  background: var(--border-color);
  border-radius: 5px;
  font-style: italic;
  font-weight: 500;
  font-size: 0.9rem;
}

.sb_table {
  display: grid;

  grid-column-gap: 10px;
  /* Spazio tra le colonne */
  width: 100%;
  /* Imposta la larghezza della tabella al 100% del contenitore */
}

.sb_row {
  display: grid;
  grid-template-columns: 10px 1fr 1fr 1fr 10px;
  grid-column-gap: 10px;
  align-items: center;
  padding-left: 9px;
  padding-right: 9px;
}

.sb_row_string {
  grid-template-columns: 10px 1fr 1fr 10fr 1fr;
}

.sb_col {
  border: 0px solid #000;
  display: flex;
  align-items: flex-end;
  flex-direction: row-reverse;
  flex-wrap: nowrap;
  align-content: flex-start;
  justify-content: flex-end;
}

.sb_inherit {
  display: inherit;
}

.long_field {
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  margin: 5px 5px 0 5px;
  border-radius: 10px;
  line-height: 1.7;
}

.sb_arrow {
  color: var(--fg-color);
}

.sb_preview_badge {
  text-align: center;
  background: var(--comfy-input-bg);
  font-weight: bold;
  color: var(--error-text);
}
</style>
