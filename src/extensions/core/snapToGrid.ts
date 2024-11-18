import { app } from '../../scripts/app'
import { LiteGraph } from '@comfyorg/litegraph'

app.registerExtension({
  name: 'Comfy.SnapToGrid',
  init() {
    // Add setting to control grid size
    app.ui.settings.addSetting({
      id: 'Comfy.SnapToGrid.GridSize',
      category: ['LiteGraph', 'Canvas', 'GridSize'],
      name: 'Snap to grid size',
      type: 'slider',
      attrs: {
        min: 1,
        max: 500
      },
      tooltip:
        'When dragging and resizing nodes while holding shift they will be aligned to the grid, this controls the size of that grid.',
      defaultValue: LiteGraph.CANVAS_GRID_SIZE,
      onChange(value) {
        LiteGraph.CANVAS_GRID_SIZE = +value || 10
      }
    })

    // Keep the 'pysssss.SnapToGrid' setting id so we don't need to migrate setting values.
    // Using a new setting id can cause existing users to lose their existing settings.
    app.ui.settings.addSetting({
      id: 'pysssss.SnapToGrid',
      category: ['LiteGraph', 'Canvas', 'AlwaysSnapToGrid'],
      name: 'Always snap to grid',
      type: 'boolean',
      defaultValue: false,
      versionAdded: '1.3.13',
      versionModified: '1.3.42',
      onChange(value) {
        app.graph.config.alwaysSnapToGrid = !!value
      }
    })
  }
})
