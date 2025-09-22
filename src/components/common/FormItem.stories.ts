import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { FormItem as FormItemType } from '@/types/settingTypes'

import FormItem from './FormItem.vue'

const meta: Meta = {
  title: 'Components/Common/FormItem',
  component: FormItem as any,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'FormItem is a generalized form component that dynamically renders different input types based on configuration. Supports text, number, boolean, combo, slider, knob, color, image, and custom renderer inputs with proper labeling and accessibility.'
      }
    }
  },
  argTypes: {
    item: {
      control: 'object',
      description:
        'FormItem configuration object defining the input type and properties'
    },
    formValue: {
      control: 'text',
      description: 'The current form value (v-model)',
      defaultValue: ''
    },
    id: {
      control: 'text',
      description: 'Optional HTML id for the form input',
      defaultValue: undefined
    },
    labelClass: {
      control: 'text',
      description: 'Additional CSS classes for the label',
      defaultValue: undefined
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj

export const TextInput: Story = {
  render: (args: any) => ({
    components: { FormItem },
    setup() {
      return { args }
    },
    data() {
      return {
        value: args.formValue || 'Default text value',
        textItem: {
          name: 'Workflow Name',
          type: 'text',
          tooltip: 'Enter a descriptive name for your workflow',
          attrs: {
            placeholder: 'e.g., SDXL Portrait Generation'
          }
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: string) {
        console.log('Text value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Text input form item with tooltip:
        </div>
        <FormItem
          :item="textItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="workflow-name"
        />
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Current value: "{{ value }}"
        </div>
      </div>
    `
  }),
  args: {
    formValue: 'My Workflow'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Text input FormItem with tooltip and placeholder. Hover over the info icon to see the tooltip.'
      }
    }
  }
}

export const NumberInput: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: 7.5,
        numberItem: {
          name: 'CFG Scale',
          type: 'number',
          tooltip:
            'Classifier-free guidance scale controls how closely the AI follows your prompt',
          attrs: {
            min: 1,
            max: 30,
            step: 0.5,
            showButtons: true
          }
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: number) {
        console.log('CFG scale updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Number input with controls and constraints:
        </div>
        <FormItem
          :item="numberItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="cfg-scale"
        />
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Current CFG scale: {{ value }}
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Number input FormItem with min/max constraints and increment buttons for CFG scale parameter.'
      }
    }
  }
}

export const BooleanToggle: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: false,
        booleanItem: {
          name: 'Enable GPU Acceleration',
          type: 'boolean',
          tooltip: 'Use GPU for faster processing when available'
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: boolean) {
        console.log('GPU acceleration toggled:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Boolean toggle switch form item:
        </div>
        <FormItem
          :item="booleanItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="gpu-accel"
        />
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          GPU acceleration: {{ value ? 'Enabled' : 'Disabled' }}
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Boolean FormItem using ToggleSwitch component for enable/disable settings.'
      }
    }
  }
}

export const ComboSelect: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: 'euler_a',
        comboItem: {
          name: 'Sampling Method',
          type: 'combo',
          tooltip: 'Algorithm used for denoising during generation',
          options: [
            'euler_a',
            'euler',
            'heun',
            'dpm_2',
            'dpm_2_ancestral',
            'lms',
            'dpm_fast',
            'dpm_adaptive',
            'dpmpp_2s_ancestral',
            'dpmpp_sde',
            'dpmpp_2m'
          ]
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: string) {
        console.log('Sampling method updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Combo select with sampling methods:
        </div>
        <FormItem
          :item="comboItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="sampling-method"
        />
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Selected: {{ value }}
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Combo select FormItem with ComfyUI sampling methods showing dropdown selection.'
      }
    }
  }
}

export const SliderInput: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: 0.7,
        sliderItem: {
          name: 'Denoise Strength',
          type: 'slider',
          tooltip:
            'How much to denoise the input image (0 = no change, 1 = complete redraw)',
          attrs: {
            min: 0,
            max: 1,
            step: 0.01
          }
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: number) {
        console.log('Denoise strength updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Slider input with precise decimal control:
        </div>
        <FormItem
          :item="sliderItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="denoise-strength"
        />
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Denoise: {{ (value * 100).toFixed(0) }}%
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Slider FormItem for denoise strength with percentage display and fine-grained control.'
      }
    }
  }
}

export const KnobInput: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: 20,
        knobItem: {
          name: 'Sampling Steps',
          type: 'knob',
          tooltip:
            'Number of denoising steps - more steps = higher quality but slower generation',
          attrs: {
            min: 1,
            max: 150,
            step: 1
          }
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: number) {
        console.log('Steps updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Knob input for sampling steps:
        </div>
        <FormItem
          :item="knobItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="sampling-steps"
        />
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Steps: {{ value }} ({{ value < 10 ? 'Very Fast' : value < 30 ? 'Fast' : value < 50 ? 'Balanced' : 'High Quality' }})
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Knob FormItem for sampling steps with quality indicator based on step count.'
      }
    }
  }
}

export const MultipleFormItems: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        widthValue: 512,
        heightValue: 512,
        stepsValue: 20,
        cfgValue: 7.5,
        samplerValue: 'euler_a',
        hiresValue: false
      }
    },
    computed: {
      formItems() {
        return [
          {
            name: 'Width',
            type: 'number',
            tooltip: 'Image width in pixels',
            attrs: { min: 64, max: 2048, step: 64 }
          },
          {
            name: 'Height',
            type: 'number',
            tooltip: 'Image height in pixels',
            attrs: { min: 64, max: 2048, step: 64 }
          },
          {
            name: 'Sampling Steps',
            type: 'knob',
            tooltip: 'Number of denoising steps',
            attrs: { min: 1, max: 150, step: 1 }
          },
          {
            name: 'CFG Scale',
            type: 'slider',
            tooltip: 'Classifier-free guidance scale',
            attrs: { min: 1, max: 30, step: 0.5 }
          },
          {
            name: 'Sampler',
            type: 'combo',
            tooltip: 'Sampling algorithm',
            options: ['euler_a', 'euler', 'heun', 'dpm_2', 'dpmpp_2m']
          },
          {
            name: 'High-res Fix',
            type: 'boolean',
            tooltip: 'Enable high-resolution generation'
          }
        ] as FormItemType[]
      },
      allSettings() {
        return {
          width: this.widthValue,
          height: this.heightValue,
          steps: this.stepsValue,
          cfg: this.cfgValue,
          sampler: this.samplerValue,
          enableHires: this.hiresValue
        }
      }
    },
    template: `
      <div style="padding: 20px; min-width: 500px;">
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">ComfyUI Generation Settings</h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Multiple form items demonstrating different input types in a realistic settings panel.
          </p>
        </div>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <FormItem
              :item="formItems[0]"
              :formValue="widthValue"
              @update:formValue="(value) => widthValue = value"
              id="form-width"
            />
            <FormItem
              :item="formItems[1]"
              :formValue="heightValue"
              @update:formValue="(value) => heightValue = value"
              id="form-height"
            />
            <FormItem
              :item="formItems[2]"
              :formValue="stepsValue"
              @update:formValue="(value) => stepsValue = value"
              id="form-steps"
            />
            <FormItem
              :item="formItems[3]"
              :formValue="cfgValue"
              @update:formValue="(value) => cfgValue = value"
              id="form-cfg"
            />
            <FormItem
              :item="formItems[4]"
              :formValue="samplerValue"
              @update:formValue="(value) => samplerValue = value"
              id="form-sampler"
            />
            <FormItem
              :item="formItems[5]"
              :formValue="hiresValue"
              @update:formValue="(value) => hiresValue = value"
              id="form-hires"
            />
          </div>
        </div>
        
        <div style="margin-top: 16px; background: rgba(0,0,0,0.05); padding: 12px; border-radius: 4px;">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">Current Settings:</div>
          <div style="font-family: monospace; font-size: 12px; color: #4b5563;">
            {{ JSON.stringify(allSettings, null, 2) }}
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Multiple FormItems demonstrating all major input types in a realistic ComfyUI settings panel.'
      }
    }
  }
}

export const WithCustomLabels: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: 'custom_model.safetensors',
        customItem: {
          name: 'Model File',
          type: 'text',
          tooltip: 'Select the checkpoint model file to use for generation',
          attrs: {
            placeholder: 'Select or enter model filename...'
          }
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: string) {
        console.log('Model file updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          FormItem with custom label styling and slots:
        </div>
        <FormItem
          :item="customItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="model-file"
          :labelClass="{ 'font-bold': true, 'text-blue-600': true }"
        >
          <template #name-prefix>
            <i class="pi pi-download" style="margin-right: 6px; color: #3b82f6;"></i>
          </template>
          <template #name-suffix>
            <span style="margin-left: 6px; font-size: 10px; color: #ef4444;">*</span>
          </template>
        </FormItem>
        <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
          Selected model: {{ value || 'None' }}
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'FormItem with custom label styling and prefix/suffix slots for enhanced UI elements.'
      }
    }
  }
}

export const ColorPicker: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: '#3b82f6',
        colorItem: {
          name: 'Theme Accent Color',
          type: 'color',
          tooltip: 'Primary accent color for the interface theme'
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: string) {
        console.log('Color updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Color picker form item:
        </div>
        <FormItem
          :item="colorItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="theme-color"
        />
        <div style="margin-top: 16px; display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 12px; color: #6b7280;">Preview:</div>
          <div 
            :style="{ 
              backgroundColor: value, 
              width: '40px', 
              height: '20px', 
              borderRadius: '4px',
              border: '1px solid #e2e8f0'
            }"
          ></div>
          <span style="font-family: monospace; font-size: 12px;">{{ value }}</span>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Color picker FormItem with live preview showing the selected color value.'
      }
    }
  }
}

export const ComboWithComplexOptions: Story = {
  render: () => ({
    components: { FormItem },
    data() {
      return {
        value: 'medium',
        comboItem: {
          name: 'Quality Preset',
          type: 'combo',
          tooltip:
            'Predefined quality settings that adjust multiple parameters',
          options: [
            { text: 'Draft (Fast)', value: 'draft' },
            { text: 'Medium Quality', value: 'medium' },
            { text: 'High Quality', value: 'high' },
            { text: 'Ultra (Slow)', value: 'ultra' }
          ]
        } as FormItemType
      }
    },
    methods: {
      updateValue(newValue: string) {
        console.log('Quality preset updated:', newValue)
        this.value = newValue
      }
    },
    computed: {
      presetDescription() {
        const descriptions = {
          draft: 'Fast generation with 10 steps, suitable for previews',
          medium: 'Balanced quality with 20 steps, good for most use cases',
          high: 'High quality with 40 steps, slower but better results',
          ultra: 'Maximum quality with 80 steps, very slow but best results'
        }
        return (descriptions as any)[this.value] || 'Unknown preset'
      }
    },
    template: `
      <div style="padding: 20px; min-width: 400px;">
        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
          Combo with complex option objects:
        </div>
        <FormItem
          :item="comboItem"
          :formValue="value"
          @update:formValue="updateValue"
          id="quality-preset"
        />
        <div style="margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <div style="font-size: 12px; font-weight: 600; color: #374151;">{{ presetDescription }}</div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Complex combo FormItem with object options showing text/value pairs and descriptions.'
      }
    }
  }
}
