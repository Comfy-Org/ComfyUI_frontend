import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import { LGraphNode } from '@comfyorg/litegraph'
import { watch } from 'vue'

import { app } from '../../scripts/app'
import { ComfyWidgets } from '../../scripts/widgets'
import { useColorPickerStore } from '../../stores/colorPickerStore'

app.registerExtension({
	name: "rgbcolorpicker",
  nodeCreated(node) {
    console.log("VUE: RGB Color Picker nodeCreated");
    console.log(node);
    
    // Add button to open color picker
    node.addWidget("button", "Open Color Picker", undefined, () => {
      const colorPickerStore = useColorPickerStore()
      
      // Get current RGB values from the node widgets
      const redWidget = node.widgets?.find(w => w.name === 'red')
      const greenWidget = node.widgets?.find(w => w.name === 'green')
      const blueWidget = node.widgets?.find(w => w.name === 'blue')
      
      if (redWidget && greenWidget && blueWidget) {
        // Set the store's selectedColor to the node's current values
        colorPickerStore.selectedColor = {
          red: redWidget.value as number,
          green: greenWidget.value as number,
          blue: blueWidget.value as number
        }
      }
      
      // Toggle the picker open state
      colorPickerStore.isOpen = !colorPickerStore.isOpen
    });

    // Watch for color changes in the store and update node widgets
    const colorPickerStore = useColorPickerStore()
    watch(() => colorPickerStore.selectedColor, (newColor) => {
      // Update the node's RGB widget values
      const redWidget = node.widgets?.find(w => w.name === 'red')
      const greenWidget = node.widgets?.find(w => w.name === 'green')
      const blueWidget = node.widgets?.find(w => w.name === 'blue')
      
      if (redWidget && greenWidget && blueWidget) {
        redWidget.value = newColor.red
        greenWidget.value = newColor.green
        blueWidget.value = newColor.blue
        
        // Trigger widget change event to update the node
        node.setDirtyCanvas(true, true)
      }
    }, { deep: true })

    // Watch for direct node widget changes and update store
    const redWidget = node.widgets?.find(w => w.name === 'red')
    const greenWidget = node.widgets?.find(w => w.name === 'green')
    const blueWidget = node.widgets?.find(w => w.name === 'blue')
    
    if (redWidget && greenWidget && blueWidget) {
      // Add change callbacks to each widget
      const originalRedCallback = redWidget.callback
      const originalGreenCallback = greenWidget.callback
      const originalBlueCallback = blueWidget.callback
      
      redWidget.callback = (value) => {
        colorPickerStore.selectedColor.red = value as number
        if (originalRedCallback) originalRedCallback(value)
      }
      
      greenWidget.callback = (value) => {
        colorPickerStore.selectedColor.green = value as number
        if (originalGreenCallback) originalGreenCallback(value)
      }
      
      blueWidget.callback = (value) => {
        colorPickerStore.selectedColor.blue = value as number
        if (originalBlueCallback) originalBlueCallback(value)
      }
    }
  },
})
