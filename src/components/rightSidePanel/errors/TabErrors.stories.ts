/**
 * @file TabErrors.stories.ts
 *
 * Error Tab – Missing Node Packs UX Flow Stories (OSS environment)
 */
import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StoryOSSMissingNodePackFlow from './__stories__/StoryOSSMissingNodePackFlow.vue'
import MockOSSMissingNodePack from './__stories__/MockOSSMissingNodePack.vue'
import MockCloudMissingNodePack from './__stories__/MockCloudMissingNodePack.vue'
import MockCloudMissingModel from './__stories__/MockCloudMissingModel.vue'
import MockCloudMissingModelBasic from './__stories__/MockCloudMissingModelBasic.vue'
import MockOSSMissingModel from './__stories__/MockOSSMissingModel.vue'

// Storybook Meta

const meta = {
  title: 'RightSidePanel/Errors/TabErrors',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
## Error Tab – Missing Node Packs UX Flow (OSS environment)

### Right Panel Structure
- **Nav Item**: "Workflow Overview" + panel-right button
- **Tab bar**: Error (octagon-alert icon) | Inputs | Nodes | Global settings
- **Search bar**: 12px, #8a8a8a placeholder
- **Missing Node Packs section**: octagon-alert (red) + label + Install All + chevron
- **Each widget row** (72px): name (truncate) + info + locate | Install node pack ↓

> In Cloud environments, the Install button is not displayed.
        `
      }
    }
  }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// Stories

/**
 * **[Local OSS] Missing Node Packs**
 *
 * A standalone story for the Right Side Panel's Error Tab mockup.
 * This allows testing the tab's interactions (install, locate, etc.) in isolation.
 */
export const OSS_ErrorTabOnly: Story = {
  name: '[Local OSS] Missing Node Packs',
  render: () => ({
    components: { MockOSSMissingNodePack },
    template: `
      <div class="h-[800px] border border-[#494a50] rounded-lg overflow-hidden">
        <MockOSSMissingNodePack @log="msg => console.log('Log:', msg)" />
      </div>
    `
  })
}

/**
 * **[Local OSS] UX Flow - Missing Node Pack**
 *
 * Full ComfyUI layout simulation:
 */
export const OSS_MissingNodePacksFullFlow: Story = {
  name: '[Local OSS] UX Flow - Missing Node Pack',
  render: () => ({
    components: { StoryOSSMissingNodePackFlow },
    template: `<div style="width:100vw;height:100vh;"><StoryOSSMissingNodePackFlow /></div>`
  }),
  parameters: {
    layout: 'fullscreen'
  }
}

/**
 * **[Cloud] Missing Node Pack**
 */
export const Cloud_MissingNodePacks: Story = {
  name: '[Cloud] Missing Node Pack',
  render: () => ({
    components: { MockCloudMissingNodePack },
    template: `
      <div class="h-[800px] border border-[#494a50] rounded-lg overflow-hidden">
        <MockCloudMissingNodePack @log="msg => console.log('Log:', msg)" />
      </div>
    `
  })
}

/**
 * **[Local OSS] Missing Model**
 */
export const OSS_MissingModels: Story = {
  name: '[Local OSS] Missing Model',
  render: () => ({
    components: { MockOSSMissingModel },
    template: `
      <div class="h-[800px] border border-[#494a50] rounded-lg overflow-hidden">
        <MockOSSMissingModel @locate="name => console.log('Locate:', name)" />
      </div>
    `
  })
}

/**
 * **[Cloud] Missing Model**
 */
export const Cloud_MissingModels: Story = {
  name: '[Cloud] Missing Model',
  render: () => ({
    components: { MockCloudMissingModelBasic },
    template: `
      <div class="h-[800px] border border-[#494a50] rounded-lg overflow-hidden">
        <MockCloudMissingModelBasic @locate="name => console.log('Locate:', name)" />
      </div>
    `
  })
}

/**
 * **[Cloud] Missing Model - with model type selector**
 */
export const Cloud_MissingModelsWithSelector: Story = {
  name: '[Cloud] Missing Model - with model type selector',
  render: () => ({
    components: { MockCloudMissingModel },
    template: `
      <div class="h-[800px] border border-[#494a50] rounded-lg overflow-hidden">
        <MockCloudMissingModel @locate="name => console.log('Locate:', name)" />
      </div>
    `
  })
}
