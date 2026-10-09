import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import EditorBusy from './EditorBusy.vue'
import EditorFrame from './EditorFrame.vue'
import EditorResult from './EditorResult.vue'

const BEFORE = '/images/cinematic-studio/options/light-golden.jpg'
const AFTER = '/images/cinematic-studio/options/light-night.jpg'

/**
 * The stage once a run is back: the result, the original, or a draggable
 * split between them. Each view sits in an `EditorFrame` sized to the image,
 * which the shell's zoom scales and pans.
 */
const meta: Meta<typeof EditorResult> = {
  title: 'Website/Workshop/AppEditor/Result',
  component: EditorResult,
  tags: ['autodocs'],
  args: {
    before: BEFORE,
    after: AFTER,
    view: 'compare',
    width: 1280,
    height: 720,
    labels: {
      resultAlt: 'The pier relit at night',
      originalAlt: 'The pier at golden hour',
      original: 'Original',
      result: 'Result',
      slider: 'Drag to compare'
    }
  },
  argTypes: {
    view: {
      control: 'inline-radio',
      options: ['compare', 'result', 'original']
    }
  },
  decorators: [
    () => ({
      template:
        '<div class="flex h-120 justify-center bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** While a run is going, the stage dims under a status card. */
export const Running: Story = {
  render: (args) => ({
    components: { EditorBusy, EditorFrame },
    setup: () => ({ args, onCancel: fn() }),
    template: `
      <div class="size-full max-w-5xl">
        <EditorFrame :width="args.width" :height="args.height">
          <img :src="args.before" :alt="args.labels.originalAlt" class="size-full rounded-sm object-cover" />
          <EditorBusy
            title="Generating"
            detail="12s elapsed"
            cancel-label="Cancel"
            @cancel="onCancel"
          />
        </EditorFrame>
      </div>
    `
  })
}
