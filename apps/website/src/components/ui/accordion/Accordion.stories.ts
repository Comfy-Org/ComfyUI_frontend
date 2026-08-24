import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import Accordion from './Accordion.vue'
import AccordionContent from './AccordionContent.vue'
import AccordionItem from './AccordionItem.vue'
import AccordionTrigger from './AccordionTrigger.vue'

const meta: Meta<typeof Accordion> = {
  title: 'Website/UI/Accordion',
  component: Accordion,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink mx-auto max-w-3xl p-8"><story /></div>'
    })
  ],
  render: (args) => ({
    components: {
      Accordion,
      AccordionContent,
      AccordionItem,
      AccordionTrigger
    },
    setup: () => ({ args }),
    template: `
      <Accordion v-bind="args">
        <AccordionItem value="workflow">
          <AccordionTrigger>What is a workflow?</AccordionTrigger>
          <AccordionContent>A reusable graph that connects models, inputs, and outputs.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="cloud">
          <AccordionTrigger>Can I run it in the cloud?</AccordionTrigger>
          <AccordionContent>Yes. The same workflow can run locally or in Comfy Cloud.</AccordionContent>
        </AccordionItem>
      </Accordion>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  args: { type: 'single', collapsible: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'What is a workflow?' })
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText(/reusable graph/)).toBeVisible()
  }
}

export const Multiple: Story = {
  args: { type: 'multiple', defaultValue: ['workflow', 'cloud'] }
}
