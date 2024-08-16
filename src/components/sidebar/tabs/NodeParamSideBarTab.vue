<template>
  <!-- catagories -->
  <SelectButton
    :style="{ height: '10%', width: '100%' }"
    class="custom-select-button"
    v-model="selectedCategory"
    :options="nodeParamStore.categories"
    optionLabel="name"
    @update:modelValue="(newValue) => (selectedCategory = newValue.name)"
    aria-labelledby="basic"
  >
    <template #option="slotProps">
      <div>{{ slotProps.option.name }} ({{ slotProps.option.count }})</div>
    </template>
  </SelectButton>
  <!-- nodes -->
  <div :style="{ height: '50%', width: '100%' }">
    <VirtualScroller
      :items="filteredNodes"
      :item-size="70"
      :style="{ height: '100%', width: '100%' }"
      :lazy="true"
      :show-loader="true"
    >
      <template #item="slotProps">
        <div
          :class="[
            'custom-header',
            { bypass: slotProps.item.mode === 2 || slotProps.item.mode === 4 },
            { selected: isSelectedNode(slotProps.item.id) }
          ]"
          :style="{ backgroundColor: slotProps.item.color }"
          @click="() => selectNode(slotProps.item.id)"
        >
          <div class="custom-header-hover"></div>
          <ToggleButton
            @click.stop
            v-model="slotProps.item.bypass"
            onIcon="pi pi-power-off"
            offIcon="pi pi-power-off"
            class="custom-toggle-button"
            @update:modelValue="
              (newValue) => onBypass(slotProps.item.id, newValue)
            "
          />
          <span>{{ slotProps.item.title }}</span>
        </div>
      </template>
    </VirtualScroller>
  </div>
  <!-- widgets -->
  <template v-if="selectedNode">
    <div
      :class="[
        'custom-content',
        { bypass: selectedNode.mode === 2 || selectedNode.mode === 4 }
      ]"
      :style="{ backgroundColor: selectedNode.bgcolor }"
    >
      <template v-for="(widget, index) in selectedNode.widgets" :key="index">
        <div class="sidebar-widget">
          <!-- widget title -->
          <span
            :class="[
              'widget-title',
              {
                hide: widget.type === 'button' || widget.type === 'customtext'
              }
            ]"
          >
            {{ widget.title }}
          </span>
          <!-- widget input -->
          <component
            :is="getComponent(widget)"
            v-bind="getComponentProps(selectedNode, widget)"
            @update:modelValue="
              (newValue) => onChange(selectedNode.id, widget.title, newValue)
            "
            @blur="onCompleteEdit"
          />
          <!-- widget fav -->
          <ToggleButton
            v-model="widget.fav"
            onIcon="pi pi-star-fill"
            offIcon="pi pi-star"
            class="custom-toggle-button"
            @update:modelValue="
              (newValue) => onFav(selectedNode.id, widget.title, newValue)
            "
          />
        </div>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import InputNumber from 'primevue/inputnumber'
import ToggleButton from 'primevue/togglebutton'
import SelectButton from 'primevue/selectbutton'
import VirtualScroller from 'primevue/virtualscroller'
import { Node, useNodeParamStore, Widget } from '@/stores/nodeParamStore'
import { computed, ref } from 'vue'

const nodeParamStore = useNodeParamStore()
nodeParamStore.updateNodes()
const selectedCategory = ref()
let selectedNode

const getComponent = (widget: Widget) => {
  switch (widget.type) {
    case 'customtext':
      return Textarea
    case 'number':
      return InputNumber
    case 'text':
      return InputText
    case 'combo':
      return Select
    case 'button':
      return Button
    case 'toggle':
      return ToggleSwitch
    default:
      return null
  }
}

const getComponentProps = (node: Node, widget: Widget) => {
  const baseProps = {
    class: `custom-${widget.type}`,
    modelValue: widget.value
  }
  switch (widget.type) {
    case 'customtext':
      return {
        ...baseProps,
        placeholder: widget.title
      }
    case 'number':
      return {
        ...baseProps,
        showButtons: true,
        useGrouping: false,
        step: widget.options.step / 10,
        min: widget.options.min,
        max: widget.options.max,
        minFractionDigits: widget.options.precision,
        onInput: (event) => onChange(node.id, widget.title, event.value)
      }
    case 'text':
      return baseProps
    case 'combo':
      return {
        ...baseProps,
        options: widget.options.values,
        filter: true
      }
    case 'button':
      return {
        ...baseProps,
        label: widget.label,
        severity: 'secondary',
        onClick: () => onWidgetBtnClick(node.id, widget.title)
      }
    case 'toggle':
      return {
        ...baseProps
      }
    default:
      return baseProps
  }
}
const selectNode = (nodeID: number) => {
  selectedNode = computed(() =>
    nodeParamStore.nodes.find((node) => node.id === nodeID)
  )
}
const isSelectedNode = (NodeID: number) => {
  if (selectedNode.value) {
    if (NodeID === selectedNode.value.id) {
      return true
    } else return false
  } else return false
}
const onChange = (nodeID: number, widgetTitle: string, newValue: any) => {
  console.log('onChange', newValue)
  nodeParamStore.setIsEditing(true)
  nodeParamStore.updateWidgetValue(nodeID, widgetTitle, newValue)
  nodeParamStore.setIsEditing(false)
}
const onCompleteEdit = () => {
  console.log('onCompleteEdit')
  nodeParamStore.setIsEditing(false)
}
const onFav = (nodeID: number, widgetTitle: string, newValue: any) => {
  console.log('onFav', newValue)
  nodeParamStore.updateWidgetFav(nodeID, widgetTitle, newValue)
}
const onBypass = (nodeID: number, newValue) => {
  console.log('onBypass', newValue)
  nodeParamStore.updateNodeMode(nodeID, newValue)
}

const onWidgetBtnClick = (nodeID: number, widgetTitle: string) => {
  nodeParamStore.clickWidgetButton(nodeID, widgetTitle)
}

const filteredNodes = computed(() => {
  if (selectedCategory.value === 'Star') {
    return nodeParamStore.favNodes
  } else if (selectedCategory.value === 'Notnull') {
    return nodeParamStore.notNullNodes
  }
  return nodeParamStore.allNodes
})
</script>

<style scoped>
.sidebar-widget {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.6rem 0;
}
.custom-header {
  height: 4rem;
  padding: 1rem;
  color: var(--p-togglebutton-color);
  display: flex;
  border-bottom: 1px solid var(--p-toolbar-border-color);
  gap: 0.6rem;
  align-items: center;
}
.custom-header-hover {
  width: 100%;
  height: 4rem;
  position: absolute;
  margin: -1rem;
  z-index: -1;
  background-color: transparent;
}
.custom-header-hover:hover {
  background-color: var(--p-togglebutton-background);
  opacity: 0.3;
}
.custom-header.bypass {
  opacity: 0.3;
}
.custom-header.selected {
  color: var(--p-splitter-color);
  border-bottom: 2px solid var(--p-button-text-primary-color);
}
.custom-content {
  height: 40%;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 1rem;
  transition: none;
  background-color: var(--comfy-menu-bg);
  border-top: 1px solid var(--p-toolbar-border-color);
}
.custom-content.bypass {
  opacity: 0.3;
}
.custom-toggle-button {
  width: 5%;
  padding: 0.6rem;
  z-index: 2;
  border: none;
  background-color: transparent !important;
}
.custom-toggle-button:deep(.p-togglebutton-label) {
  display: none !important;
}
.custom-toggle-button::before {
  background-color: transparent !important;
}
.custom-select-button {
  height: 10%;
  display: flex;
  justify-content: center;
  padding: 0.6rem;
  box-sizing: border-box;
  background-color: var(--p-accordion-header-background);
  border-radius: 0;
  border-bottom: 1px solid var(--p-toolbar-border-color);
}
.custom-combo {
  width: 65%;
  font-size: 1rem;
  overflow: hidden;
}
.widget-title {
  width: 30%;
  font-size: 1rem;
  overflow: hidden;
}
.widget-title.hide {
  display: none;
}
.custom-slider {
  width: 50%;
}

.custom-number {
  width: 65%;
  font-size: 1rem;
  overflow: hidden;
}
.custom-number:deep(input) {
  width: 100%;
}
.custom-text {
  width: 65%;
  font-size: 1rem;
  overflow: hidden;
}
.custom-button {
  width: 95%;
  font-size: medium;
  overflow: hidden;
}
.custom-customtext {
  width: 95%;
  min-height: 150px;
  resize: vertical;
}
:deep(.p-accordioncontent-content) {
  padding: 1.2rem !important;
}
:deep(.p-virtualscroller-content) {
  width: 100%;
}
.empty-avoid-auto-refresh {
  height: 500px;
}
</style>
