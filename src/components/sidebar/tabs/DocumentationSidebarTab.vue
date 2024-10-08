<template>
  <div v-if="!hasAnyDoc()">No documentation available</div>
  <div v-else-if="Array.isArray(def.description)" ref="docElement">
    {{ def[1] }}
  </div>
  <div v-else ref="docElement">
    <div class="doc-node">{{ def.display_name }}</div>
    <div v-if="hasInputDoc()" class="doc-section">Inputs</div>
    <div
      v-if="hasInputDoc()"
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
<script lang="ts">
import { ref, watch } from 'vue'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
var docElement = ref(null)

let def
const inputs = ref([])
const outputs = ref([])

export function selectDocItem(node, name, value) {
  if (node != app?.canvas?.current_node || name == 'DESCRIPTION') {
    return false
  }
  selectHelp(name, value)
  return true
}
function setCollapse(el, doCollapse) {
  if (doCollapse) {
    el.children[0].children[0].innerHTML = '+'
    Object.assign(el.children[1].style, {
      color: '#CCC',
      overflowX: 'hidden',
      width: '0px',
      minWidth: 'calc(100% - 20px)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    })
    for (let child of el.children[1].children) {
      if (child.style.display != 'none') {
        child.origDisplay = child.style.display
      }
      child.style.display = 'none'
    }
  } else {
    el.children[0].children[0].innerHTML = '-'
    Object.assign(el.children[1].style, {
      color: '',
      overflowX: '',
      width: '100%',
      minWidth: '',
      textOverflow: '',
      whiteSpace: ''
    })
    for (let child of el.children[1].children) {
      child.style.display = child.origDisplay
    }
  }
}
function collapseOnClick() {
  let doCollapse = this.children[0].innerHTML == '-'
  setCollapse(this.parentElement, doCollapse)
}
function selectHelp(name: string, value?: string) {
  if (!docElement.value) {
    console.log("doc element doesn't exist")
    return null
  }
  if (def[2]?.select) {
    return def[2].select(docElement.value, name, value)
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
function updateNode(node?) {
  console.log('updating node')
  node ||= app?.canvas?.current_node
  if (!node) {
    // Graph has no nodes
    return
  }
  def = LiteGraph.getNodeType(node.type).nodeData
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
function hasInputDoc() {
  return !!inputs.value.length
}
function hasAnyDoc() {
  return def?.description || inputs.value.length || outputs.value.length
}
export default {
  setup() {
    const canvasStore = useCanvasStore()
    watch(() => canvasStore?.canvas?.current_node, updateNode)
    updateNode()
    return { hasInputDoc, hasAnyDoc, inputs, outputs, def, docElement }
  }
}
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
.DocumentationIcon:before {
  font-size: 1.5em;
  content: '?';
}
</style>
