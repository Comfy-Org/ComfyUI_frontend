<template>
  <div v-if="!hasAnyDoc()">Select a node to see documentation.</div>
  <div v-else-if="rawDoc" ref="docElement" v-html="rawDoc"></div>
  <div v-else ref="docElement">
    <div class="doc-node">{{ title }}</div>
    <div>{{ description }}</div>
    <div v-if="inputs.length" class="doc-section">Inputs</div>
    <div
      v-if="inputs.length"
      v-for="input in inputs"
      tabindex="-1"
      class="doc-item"
    >
      {{ input[0] }}
      <div>{{ input[1] }}</div>
    </div>
    <div v-if="outputs.length" class="doc-section">Outputs</div>
    <div
      v-if="outputs.length"
      v-for="output in outputs"
      tabindex="-1"
      class="doc-item"
    >
      {{ output[0] }}
      <div>{{ output[1] }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount, isReactive } from 'vue'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useHoveredItemStore } from '@/stores/graphStore'
const hoveredItemStore = useHoveredItemStore()
const canvasStore = useCanvasStore()

const docElement = ref(null)

let def
const rawDoc = ref(null)
const description = ref(null)
const title = ref(null)
const inputs = ref([])
const outputs = ref([])

function selectHelp(name: string, value?: string) {
  if (!docElement.value || !name) {
    return null
  }
  if (def.description[2]?.select) {
    return def.description[2].select(docElement.value, name, value)
  }
  //attempt to navigate to name in help
  function collapseUnlessMatch(items, t) {
    var match = items.querySelector('[doc_title="' + t + '"]')
    if (!match) {
      for (let i of items.children) {
        if (i.innerHTML.slice(0, t.length + 5).includes(t)) {
          match = i
          break
        }
      }
    }
    if (!match) {
      return null
    }
    //For longer documentation items with fewer collapsable elements,
    //scroll to make sure the entirety of the selected item is visible
    match.scrollIntoView({ block: 'nearest' })
    //The previous floating help implementation would try to scroll the window
    //itself if the display was partiall offscreen. As the sidebar documentation
    //does not pan with the canvas, this should no longer be needed
    //window.scrollTo(0, 0)
    for (let i of items.querySelectorAll('.doc_collapse')) {
      if (i.contains(match)) {
        setCollapse(i, false)
      } else {
        setCollapse(i, true)
      }
    }
    return match
  }
  let target = collapseUnlessMatch(docElement.value, name)
  if (target) {
    target.focus()
    if (value) {
      collapseUnlessMatch(target, value)
    }
  }
}
function updateNode() {
  //Grab the topmost node.
  //current_node is topmost on screen and
  //selectedItems is unordered
  const node = app?.graph?._nodes[app?.graph?._nodes.length - 1]
  if (!node) {
    // Graph has no nodes
    return
  }
  const nodeDef = LiteGraph.getNodeType(node.type).nodeData
  if (def == nodeDef) {
    return
  }
  def = nodeDef
  title.value = def.display_name
  if (Array.isArray(def.description)) {
    rawDoc.value = def.description[1]
    outputs.value = []
    inputs.value = []
    return
  } else {
    rawDoc.value = null
  }
  description.value = def.description
  let input_temp = []
  for (let k in def?.input?.required) {
    if (def.input.required[k][1]?.tooltip) {
      input_temp.push([k, def.input.required[k][1].tooltip])
    }
  }
  for (let k in def?.optional?.required) {
    if (def.input.optional[k][1]?.tooltip) {
      input_temp.push([k, def.input.optional[k][1].tooltip])
    }
  }
  inputs.value = input_temp
  if (def.output_tooltips) {
    const outputs_temp = []
    const output_name = def.output_name || def.output
    for (let i = 0; i < def.output_tooltips.length; i++) {
      outputs_temp[i] = [output_name[i], def.output_tooltips[i]]
    }
    outputs.value = outputs_temp
  } else {
    outputs.value = []
  }
}
function hasAnyDoc() {
  return def?.description || inputs.value.length || outputs.value.length
}
watch(hoveredItemStore, (hoveredItem) => {
  if (!hoveredItem.value) {
    return
  }
  const item = hoveredItem.value
  const nodeDef = LiteGraph.getNodeType(item.node.type).nodeData
  if (nodeDef != def) {
    return
  }
  if (item.type == 'DESCRIPTION') {
    return
  } else if (item.type == 'Input') {
    selectHelp(item.inputName)
    hoveredItem.value = null
  } else if (item.type == 'Output') {
    selectHelp(nodeDef?.output?.all?.[item.outputSlot]?.name)
    hoveredItem.value = null
  } else if (item.type == 'Widget') {
    selectHelp(item.widget.name, item.widget.value)
    hoveredItem.value = null
  }
})
if (isReactive(canvasStore?.canvas)) {
  watch(() => canvasStore.canvas?.current_node, updateNode)
} else {
  let interval = setInterval(updateNode, 300)
  onBeforeUnmount(() => clearInterval(this.interval))
}
updateNode()
</script>

<style scoped>
.doc-node {
  font-size: 1.5em;
}
.doc-section {
  background-color: var(--comfy-menu-bg);
}
.doc-item div {
  margin-inline-start: 1vw;
}
@keyframes selectAnimation {
  0% {
    background-color: #5555;
  }
  80% {
    background-color: #5555;
  }
  100% {
    background-color: #0000;
  }
}
.doc-item:focus {
  animation: selectAnimation 2s;
}
</style>
