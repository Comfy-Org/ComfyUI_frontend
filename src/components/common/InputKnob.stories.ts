import type { Meta, StoryObj } from '@storybook/vue3-vite'

import InputKnob from './InputKnob.vue'

const meta: Meta<typeof InputKnob> = {
  title: 'Components/Common/InputKnob',
  component: InputKnob,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'InputKnob combines a PrimeVue Knob and InputNumber for dual input methods. It features value synchronization, range validation, step constraints, and automatic decimal precision handling based on step values.'
      }
    }
  },
  argTypes: {
    modelValue: {
      control: { type: 'number' },
      description: 'Current numeric value (v-model)',
      defaultValue: 50
    },
    min: {
      control: { type: 'number' },
      description: 'Minimum allowed value',
      defaultValue: 0
    },
    max: {
      control: { type: 'number' },
      description: 'Maximum allowed value',
      defaultValue: 100
    },
    step: {
      control: { type: 'number', step: 0.01 },
      description: 'Step increment for both knob and input',
      defaultValue: 1
    },
    resolution: {
      control: { type: 'number', min: 0, max: 5 },
      description:
        'Number of decimal places to display (auto-calculated from step if not provided)',
      defaultValue: undefined
    },
    inputClass: {
      control: 'text',
      description: 'Additional CSS classes for the number input',
      defaultValue: undefined
    },
    knobClass: {
      control: 'text',
      description: 'Additional CSS classes for the knob',
      defaultValue: undefined
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof InputKnob>

export const Default: Story = {
  render: (args) => ({
    components: { InputKnob },
    setup() {
      return { args }
    },
    data() {
      return {
        value: args.modelValue || 50
      }
    },
    methods: {
      handleUpdate(newValue: number) {
        console.log('Value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <strong>Current Value: {{ value }}</strong>
        </div>
        <InputKnob
          :modelValue="value"
          :min="args.min"
          :max="args.max"
          :step="args.step"
          :resolution="args.resolution"
          :inputClass="args.inputClass"
          :knobClass="args.knobClass"
          @update:modelValue="handleUpdate"
        />
      </div>
    `
  }),
  args: {
    modelValue: 50,
    min: 0,
    max: 100,
    step: 1
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default InputKnob with range 0-100 and step of 1. Use either the knob or number input to change the value.'
      }
    }
  }
}

export const DecimalPrecision: Story = {
  render: (args) => ({
    components: { InputKnob },
    setup() {
      return { args }
    },
    data() {
      return {
        value: args.modelValue || 2.5
      }
    },
    methods: {
      handleUpdate(newValue: number) {
        console.log('Decimal value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <strong>Precision Value: {{ value }}</strong>
        </div>
        <InputKnob
          :modelValue="value"
          :min="args.min"
          :max="args.max"
          :step="args.step"
          :resolution="args.resolution"
          @update:modelValue="handleUpdate"
        />
      </div>
    `
  }),
  args: {
    modelValue: 2.5,
    min: 0,
    max: 10,
    step: 0.1
  },
  parameters: {
    docs: {
      description: {
        story:
          'InputKnob with decimal step (0.1) - automatically shows one decimal place based on step precision.'
      }
    }
  }
}

export const HighPrecision: Story = {
  render: (args) => ({
    components: { InputKnob },
    setup() {
      return { args }
    },
    data() {
      return {
        value: args.modelValue || 1.234
      }
    },
    methods: {
      handleUpdate(newValue: number) {
        console.log('High precision value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <strong>High Precision: {{ value }}</strong>
        </div>
        <InputKnob
          :modelValue="value"
          :min="args.min"
          :max="args.max"
          :step="args.step"
          :resolution="args.resolution"
          @update:modelValue="handleUpdate"
        />
      </div>
    `
  }),
  args: {
    modelValue: 1.234,
    min: 0,
    max: 5,
    step: 0.001,
    resolution: 3
  },
  parameters: {
    docs: {
      description: {
        story:
          'High precision InputKnob with step of 0.001 and 3 decimal places resolution.'
      }
    }
  }
}

export const LargeRange: Story = {
  render: (args) => ({
    components: { InputKnob },
    setup() {
      return { args }
    },
    data() {
      return {
        value: args.modelValue || 500
      }
    },
    methods: {
      handleUpdate(newValue: number) {
        console.log('Large range value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <strong>Large Range Value: {{ value }}</strong>
        </div>
        <InputKnob
          :modelValue="value"
          :min="args.min"
          :max="args.max"
          :step="args.step"
          @update:modelValue="handleUpdate"
        />
      </div>
    `
  }),
  args: {
    modelValue: 500,
    min: 0,
    max: 1000,
    step: 10
  },
  parameters: {
    docs: {
      description: {
        story:
          'InputKnob with large range (0-1000) and step of 10 for coarser control.'
      }
    }
  }
}

export const NegativeRange: Story = {
  render: (args) => ({
    components: { InputKnob },
    setup() {
      return { args }
    },
    data() {
      return {
        value: args.modelValue || 0
      }
    },
    methods: {
      handleUpdate(newValue: number) {
        console.log('Negative range value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px;">
          <strong>Negative Range: {{ value }}</strong>
        </div>
        <InputKnob
          :modelValue="value"
          :min="args.min"
          :max="args.max"
          :step="args.step"
          @update:modelValue="handleUpdate"
        />
      </div>
    `
  }),
  args: {
    modelValue: 0,
    min: -50,
    max: 50,
    step: 5
  },
  parameters: {
    docs: {
      description: {
        story:
          'InputKnob with negative range (-50 to 50) demonstrating bidirectional control.'
      }
    }
  }
}

// ComfyUI specific examples
export const CFGScale: Story = {
  render: () => ({
    components: { InputKnob },
    data() {
      return {
        cfgScale: 7.5
      }
    },
    methods: {
      updateCFG(value: number) {
        console.log('CFG Scale updated:', value)
        this.cfgScale = value
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 12px; font-weight: 600; color: #374151;">
          CFG Scale
        </div>
        <div style="margin-bottom: 8px; font-size: 14px; color: #6b7280;">
          Controls how closely the model follows the prompt
        </div>
        <InputKnob
          :modelValue="cfgScale"
          :min="1"
          :max="20"
          :step="0.5"
          @update:modelValue="updateCFG"
        />
        <div style="margin-top: 8px; font-size: 12px; color: #9ca3af;">
          Current: {{ cfgScale }} (Recommended: 6-8)
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'ComfyUI CFG Scale parameter example - common parameter for controlling prompt adherence.'
      }
    }
  }
}

export const SamplingSteps: Story = {
  render: () => ({
    components: { InputKnob },
    data() {
      return {
        steps: 20
      }
    },
    methods: {
      updateSteps(value: number) {
        console.log('Sampling steps updated:', value)
        this.steps = value
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 12px; font-weight: 600; color: #374151;">
          Sampling Steps
        </div>
        <div style="margin-bottom: 8px; font-size: 14px; color: #6b7280;">
          Number of denoising steps for image generation
        </div>
        <InputKnob
          :modelValue="steps"
          :min="1"
          :max="150"
          :step="1"
          @update:modelValue="updateSteps"
        />
        <div style="margin-top: 8px; font-size: 12px; color: #9ca3af;">
          Current: {{ steps }} (Higher = better quality, slower)
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'ComfyUI Sampling Steps parameter example - controls generation quality vs speed.'
      }
    }
  }
}

export const DenoiseStrength: Story = {
  render: () => ({
    components: { InputKnob },
    data() {
      return {
        denoise: 1.0
      }
    },
    methods: {
      updateDenoise(value: number) {
        console.log('Denoise strength updated:', value)
        this.denoise = value
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 12px; font-weight: 600; color: #374151;">
          Denoise Strength
        </div>
        <div style="margin-bottom: 8px; font-size: 14px; color: #6b7280;">
          How much noise to add (1.0 = complete denoising)
        </div>
        <InputKnob
          :modelValue="denoise"
          :min="0"
          :max="1"
          :step="0.01"
          @update:modelValue="updateDenoise"
        />
        <div style="margin-top: 8px; font-size: 12px; color: #9ca3af;">
          Current: {{ denoise }} (0.0 = no change, 1.0 = full generation)
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'ComfyUI Denoise Strength parameter example - high precision control for img2img workflows.'
      }
    }
  }
}

export const CustomStyling: Story = {
  render: () => ({
    components: { InputKnob },
    data() {
      return {
        value: 75
      }
    },
    methods: {
      updateValue(newValue: number) {
        console.log('Custom styled value updated:', newValue)
        this.value = newValue
      }
    },
    template: `
      <div style="padding: 20px;">
        <div style="margin-bottom: 16px; font-weight: 600;">
          Custom Styled InputKnob
        </div>
        <InputKnob
          :modelValue="value"
          :min="0"
          :max="100"
          :step="1"
          inputClass="custom-input"
          knobClass="custom-knob"
          @update:modelValue="updateValue"
        />
        <style>
          .custom-input {
            font-weight: bold;
            color: #2563eb;
          }
          .custom-knob {
            transform: scale(1.2);
          }
        </style>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'InputKnob with custom CSS classes applied to both knob and input components.'
      }
    }
  }
}

// Gallery showing different parameter types
export const ParameterGallery: Story = {
  render: () => ({
    components: { InputKnob },
    data() {
      return {
        params: {
          cfg: 7.5,
          steps: 20,
          denoise: 1.0,
          temperature: 0.8
        }
      }
    },
    methods: {
      updateParam(param: string, value: number) {
        console.log(`${param} updated:`, value)
        ;(this.params as any)[param] = value
      }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; padding: 20px; max-width: 600px;">
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">CFG Scale</div>
          <InputKnob
            :modelValue="params.cfg"
            :min="1"
            :max="20"
            :step="0.5"
            @update:modelValue="(v) => updateParam('cfg', v)"
          />
        </div>
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">Steps</div>
          <InputKnob
            :modelValue="params.steps"
            :min="1"
            :max="100"
            :step="1"
            @update:modelValue="(v) => updateParam('steps', v)"
          />
        </div>
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">Denoise</div>
          <InputKnob
            :modelValue="params.denoise"
            :min="0"
            :max="1"
            :step="0.01"
            @update:modelValue="(v) => updateParam('denoise', v)"
          />
        </div>
        <div>
          <div style="font-weight: 600; margin-bottom: 8px;">Temperature</div>
          <InputKnob
            :modelValue="params.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            @update:modelValue="(v) => updateParam('temperature', v)"
          />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Gallery showing different parameter types commonly used in ComfyUI workflows.'
      }
    }
  }
}
