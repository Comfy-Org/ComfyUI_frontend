import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BuildConfiguratorSplit01 from './BuildConfiguratorSplit01.vue'

const meta: Meta<typeof BuildConfiguratorSplit01> = {
  title: 'Website/Blocks/BuildConfiguratorSplit01',
  component: BuildConfiguratorSplit01,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="min-h-screen bg-primary-comfy-ink"><story /></div>'
    })
  ],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '1000px' },
          type: 'desktop'
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet'
        },
        mobile: {
          name: 'Mobile',
          styles: { width: '390px', height: '844px' },
          type: 'mobile'
        }
      }
    }
  },
  args: {
    heading: 'One approved ComfyUI environment, everywhere your team runs it.',
    body: 'Define the ComfyUI release, custom nodes, models, and dependencies your team is approved to run. Ship the same versioned build wherever the work happens.',
    features: [
      'Private custom nodes and models',
      'Use supported provider keys and existing contracts',
      'Assign approved builds through company identity'
    ],
    eyebrow: 'MANAGED BUILDS',
    releasesLabel: 'COMFYUI RELEASE',
    releases: ['v0.34.2', 'v0.34.0', 'v0.33.1'],
    environmentsLabel: 'PYTHON · PYTORCH · CUDA',
    environments: [
      { id: 'env-1', python: '3.12', torch: '2.12.1', cuda: '13.0' },
      { id: 'env-2', python: '3.11', torch: '2.8.0', cuda: '12.8' }
    ],
    nodesLabel: 'CUSTOM NODES',
    nodes: [
      { id: 'manager', label: 'ComfyUI-Manager', selected: true },
      { id: 'ipadapter', label: 'IPAdapter Plus', selected: true },
      { id: 'controlnet', label: 'ControlNet Aux' },
      { id: 'videohelper', label: 'VideoHelperSuite', selected: true },
      {
        id: 'studio-nodes',
        label: 'studio-nodes (private)',
        selected: true,
        mono: true
      }
    ],
    modelsLabel: 'MODELS',
    models: [
      { id: 'flux', label: 'FLUX 3', selected: true },
      { id: 'wan', label: 'Wan 3.0' },
      { id: 'sdxl', label: 'SDXL Base', selected: true },
      { id: 'ltx', label: 'LTX-2.5' },
      { id: 'brand-lora', label: 'brand-lora (private)', selected: true }
    ],
    cta: {
      label: 'BUILD',
      href: 'https://platform.comfy.org',
      target: '_blank'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutFeatures: Story = {
  args: { features: [] }
}

export const WithPanelTitle: Story = {
  args: { panelTitle: 'Define your build' }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}

export const ConfiguratorDesktop: Story = {
  globals: {
    viewport: { value: 'desktop', isRotated: false }
  }
}

export const ConfiguratorTablet: Story = {
  globals: {
    viewport: { value: 'tablet', isRotated: false }
  }
}

export const ConfiguratorMobile: Story = {
  globals: {
    viewport: { value: 'mobile', isRotated: false }
  }
}
