import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from './Button.vue'
import { FOR_STORIES } from '@/components/ui/button/button.variants'

const { variants, sizes } = FOR_STORIES
const meta: Meta<typeof Button> = {
  title: 'Components/Button/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: sizes,
      defaultValue: 'md'
    },
    variant: {
      control: { type: 'select' },
      options: variants,
      defaultValue: 'primary'
    },
    as: { defaultValue: 'button' },
    asChild: { defaultValue: false },
    default: {
      defaultValue: 'Button'
    }
  },
  args: {
    variant: 'secondary',
    size: 'md',
    default: 'Button'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const SingleButton: Story = {
  args: {
    variant: 'primary',
    size: 'lg'
  }
}

function generateVariants() {
  const variantButtons: string[] = []
  for (const variant of variants) {
    for (const size of sizes) {
      variantButtons.push(
        `<Button 
            variant="${variant}"
            size="${size}">${
              size.startsWith('icon')
                ? `<i class="icon-[lucide--settings]" />`
                : variant
            }</Button>`
      )
    }
  }
  return variantButtons
}

// Note: Keep the number of columns here aligned with the number of sizes above.
export const AllVariants: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="grid grid-cols-5 gap-4 place-items-center-safe">
      ${generateVariants().join('\n')}
        
      </div>
    `
  })
}
