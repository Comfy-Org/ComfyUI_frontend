<template>
  <Accordion value="0">
    <!-- gallery: maybe will merge to other sidepanel -->
    <!-- <AccordionPanel value="carousel">
      <AccordionHeader>
        <i class="pi pi-image" />
        Gallery
      </AccordionHeader>
      <AccordionContent>
        <p class="m-0">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </p>
      </AccordionContent>
    </AccordionPanel> -->
    <SelectButton
      class="custom-select-button"
      v-model="selectedCategory"
      :options="nodeParamStore.categories"
      optionLabel="name"
      @update:modelValue="(newValue) => onSelectCata(newValue)"
      aria-labelledby="basic"
    />
    <!-- nodes -->
    <AccordionPanel
      v-for="(node, index) in nodeParamStore.filterNodes"
      :key="index"
      :value="node.id.toString()"
    >
      <AccordionHeader
        :class="[
          'custom-header',
          { bypass: node.mode === 2 || node.mode === 4 }
        ]"
        :style="{ backgroundColor: node.color }"
      >
        <ToggleButton
          @click.stop
          v-model="node.bypass"
          onIcon="pi pi-power-off"
          offIcon="pi pi-power-off"
          class="custom-toggle"
          @update:modelValue="(newValue) => onBypass(node.id, newValue)"
        />
        {{ node.title }}
      </AccordionHeader>
      <AccordionContent
        :class="[
          'custom-content',
          { bypass: node.mode === 2 || node.mode === 4 }
        ]"
        :style="{ backgroundColor: node.bgcolor }"
      >
        <template v-for="(widget, index) in node.widgets" :key="index">
          <!-- textarea -->
          <template v-if="widget.type === 'customtext'">
            <div class="sidebar-widget">
              <Textarea
                placeholder="input"
                v-model="widget.value"
                class="custom-textarea"
                @input="onEdit"
                @update:model-value="
                  (newValue) => onChange(node.id, widget.title, newValue)
                "
                @blur="onCompleteEdit()"
              />
              <ToggleButton
                v-model="widget.fav"
                onIcon="pi pi-star-fill"
                offIcon="pi pi-star"
                class="w-full sm:w-40 custom-toggle"
                @update:modelValue="
                  (newValue) => onFav(node.id, widget.title, newValue)
                "
              />
            </div>
          </template>
          <!-- number -->
          <template v-if="widget.type === 'number'">
            <div class="sidebar-widget">
              <span class="widget-title">{{ widget.title }}</span>
              <!-- <Slider
                class="custom-slider"
                v-model="widget.value"
                :min="widget.options.min"
                :max="widget.options.max"
                :step="widget.options.step"
                @change="onEdit"
                @slideend="
                  (event) => onChange(node.id, widget.title, event.value)
                "
              /> -->
              <InputNumber
                class="custom-input-number"
                showButtons
                v-model.number="widget.value"
                :min="widget.options.min"
                :max="widget.options.max"
                @input="onEdit"
                @update:model-value="
                  (newValue) => onChange(node.id, widget.title, newValue)
                "
                @blur="onCompleteEdit"
                :maxFractionDigits="widget.options.precision"
              />
              <ToggleButton
                v-model="widget.fav"
                onIcon="pi pi-star-fill"
                offIcon="pi pi-star"
                class="custom-toggle"
                @update:modelValue="
                  (newValue) => onFav(node.id, widget.title, newValue)
                "
              />
            </div>
          </template>
          <!-- text -->
          <template v-if="widget.type === 'text'">
            <div class="sidebar-widget">
              <span class="widget-title">{{ widget.title }}</span>
              <InputText
                class="custom-text"
                v-model.number="widget.value"
                @input="onEdit"
                @update:model-value="
                  (newValue) => onChange(node.id, widget.title, newValue)
                "
                @blur="onCompleteEdit"
              />
              <ToggleButton
                v-model="widget.fav"
                onIcon="pi pi-star-fill"
                offIcon="pi pi-star"
                class="custom-toggle"
                @update:modelValue="
                  (newValue) => onFav(node.id, widget.title, newValue)
                "
              />
            </div>
          </template>
          <!-- combo -->
          <template v-if="widget.type === 'combo'">
            <div class="sidebar-widget">
              <span class="widget-title">{{ widget.title }}</span>
              <Select
                class="custom-select"
                v-model="widget.value"
                :options="widget.options.values"
                filter
                @input="onEdit"
                @update:modelValue="
                  (newValue) => onChange(node.id, widget.title, newValue)
                "
                @blur="onCompleteEdit"
              />
              <ToggleButton
                v-model="widget.fav"
                onIcon="pi pi-star-fill"
                offIcon="pi pi-star"
                class="custom-toggle"
                @update:modelValue="
                  (newValue) => onFav(node.id, widget.title, newValue)
                "
              />
            </div>
          </template>
          <!-- button -->
          <template v-if="widget.type === 'button'">
            <div class="sidebar-widget">
              <Button
                class="custom-Button"
                severity="secondary"
                :label="widget.label"
                @click="onWidgetBtnClick(node.id, widget.title)"
              />
              <ToggleButton
                v-model="widget.fav"
                onIcon="pi pi-star-fill"
                offIcon="pi pi-star"
                class="custom-toggle"
                @update:modelValue="
                  (newValue) => onFav(node.id, widget.title, newValue)
                "
              />
            </div>
          </template>
        </template>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import ToggleButton from 'primevue/togglebutton'
import SelectButton from 'primevue/selectbutton'
import AccordionPanel from 'primevue/accordionpanel'
import { useNodeParamStore } from '@/stores/nodeParamStore'
import { computed, ref } from 'vue'

const nodeParamStore = useNodeParamStore()
nodeParamStore.updateNodes()
const selectedCategory = ref(nodeParamStore.categories[0])
const isBypass = ref()

const onEdit = () => {
  console.log('onEdit')
  nodeParamStore.setIsEditing(true)
}
const onChange = (nodeID: number, widgetTitle: string, newValue: any) => {
  console.log('onChange', newValue)
  nodeParamStore.updateWidgetValue(nodeID, widgetTitle, newValue)
  nodeParamStore.setIsEditing(false)
}
const onCompleteEdit = () => {
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

const onSelectCata = (newValue) => {
  console.log('onSelectCata', newValue)
  if (newValue) {
    nodeParamStore.updateCatagories(newValue.name)
  } else {
    nodeParamStore.updateCatagories('All')
  }
}
</script>

<style scoped>
.sidebar-widget {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.6rem 0;
}
.custom-header.bypass {
  opacity: 0.3;
}
.custom-content.bypass {
  opacity: 0.3;
}
.custom-toggle {
  width: 5%;
  padding: 0.6rem;
  border: none;
  background-color: transparent !important;
}
.custom-toggle::before {
  background-color: transparent !important;
}
.custom-select-button {
  display: flex;
  justify-content: center;
  padding: 0.6rem;
  box-sizing: border-box;
  background-color: var(--p-accordion-header-background);
  border-radius: 0;
  border-bottom: var(--p-accordion-header-border-color) 1px solid;
}
.custom-select {
  width: 65%;
  font-size: 1rem;
  overflow: hidden;
}
.widget-title {
  width: 30%;
  font-size: 1rem;
  overflow: hidden;
}
.custom-toggle:deep(.p-togglebutton-label) {
  display: none !important;
}

.custom-slider {
  width: 50%;
}

.custom-input-number {
  width: 65%;
  font-size: 1rem;
  overflow: hidden;
}
.custom-text {
  width: 65%;
  font-size: 1rem;
  overflow: hidden;
}
.custom-Button {
  width: 95%;
  font-size: medium;
  overflow: hidden;
}
.custom-textarea {
  width: 95%;
  min-height: 150px;
  resize: vertical;
}

:deep(.p-accordioncontent-content) {
  padding: 1.2rem !important;
}
</style>
