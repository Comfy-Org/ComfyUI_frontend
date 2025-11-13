import { defineComfyExtConfig } from '@/extensions/utils'

export default defineComfyExtConfig({
  name: 'Comfy.Load3D',
  activationEvents: ['onWidgets:contributes', 'onCommands:contributes', 'onSettings:contributes'],
  contributes: [
    {
      name: 'Comfy.Preview3D',
      widgets: ['PREVIEW_3D'],
    },
    {
      name: 'Comfy.Load3D',
      widgets: ['LOAD_3D'],
      settings: [
        {
          id: 'Comfy.Load3D.ShowGrid',
          category: ['3D', 'Scene', 'Initial Grid Visibility'],
          name: 'Initial Grid Visibility',
          tooltip:
            'Controls whether the grid is visible by default when a new 3D widget is created. This default can still be toggled individually for each widget after creation.',
          type: 'boolean',
          defaultValue: true,
          experimental: true
        },
        {
          id: 'Comfy.Load3D.BackgroundColor',
          category: ['3D', 'Scene', 'Initial Background Color'],
          name: 'Initial Background Color',
          tooltip:
            'Controls the default background color of the 3D scene. This setting determines the background appearance when a new 3D widget is created, but can be adjusted individually for each widget after creation.',
          type: 'color',
          defaultValue: '282828',
          experimental: true
        },
        {
          id: 'Comfy.Load3D.CameraType',
          category: ['3D', 'Camera', 'Initial Camera Type'],
          name: 'Initial Camera Type',
          tooltip:
            'Controls whether the camera is perspective or orthographic by default when a new 3D widget is created. This default can still be toggled individually for each widget after creation.',
          type: 'combo',
          options: ['perspective', 'orthographic'],
          defaultValue: 'perspective',
          experimental: true
        },
        {
          id: 'Comfy.Load3D.LightIntensity',
          category: ['3D', 'Light', 'Initial Light Intensity'],
          name: 'Initial Light Intensity',
          tooltip:
            'Sets the default brightness level of lighting in the 3D scene. This value determines how intensely lights illuminate objects when a new 3D widget is created, but can be adjusted individually for each widget after creation.',
          type: 'number',
          defaultValue: 3,
          experimental: true
        },
        {
          id: 'Comfy.Load3D.LightIntensityMaximum',
          category: ['3D', 'Light', 'Light Intensity Maximum'],
          name: 'Light Intensity Maximum',
          tooltip:
            'Sets the maximum allowable light intensity value for 3D scenes. This defines the upper brightness limit that can be set when adjusting lighting in any 3D widget.',
          type: 'number',
          defaultValue: 10,
          experimental: true
        },
        {
          id: 'Comfy.Load3D.LightIntensityMinimum',
          category: ['3D', 'Light', 'Light Intensity Minimum'],
          name: 'Light Intensity Minimum',
          tooltip:
            'Sets the minimum allowable light intensity value for 3D scenes. This defines the lower brightness limit that can be set when adjusting lighting in any 3D widget.',
          type: 'number',
          defaultValue: 1,
          experimental: true
        },
        {
          id: 'Comfy.Load3D.LightAdjustmentIncrement',
          category: ['3D', 'Light', 'Light Adjustment Increment'],
          name: 'Light Adjustment Increment',
          tooltip:
            'Controls the increment size when adjusting light intensity in 3D scenes. A smaller step value allows for finer control over lighting adjustments, while a larger value results in more noticeable changes per adjustment.',
          type: 'slider',
          attrs: {
            min: 0.1,
            max: 1,
            step: 0.1
          },
          defaultValue: 0.5,
          experimental: true
        },
        {
          id: 'Comfy.Load3D.3DViewerEnable',
          category: ['3D', '3DViewer', 'Enable'],
          name: 'Enable 3D Viewer (Beta)',
          tooltip:
            'Enables the 3D Viewer (Beta) for selected nodes. This feature allows you to visualize and interact with 3D models directly within the full size 3d viewer.',
          type: 'boolean',
          defaultValue: false,
          experimental: true
        }
      ],
      commands: [
        {
          id: 'Comfy.3DViewer.Open3DViewer',
          icon: 'pi pi-pencil',
          label: 'Open 3D Viewer (Beta) for Selected Node',
        }
      ],
    },
  ],
})
