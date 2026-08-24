import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '../button/Button.vue'
import Card from './Card.vue'
import CardContent from './CardContent.vue'
import CardDescription from './CardDescription.vue'
import CardFooter from './CardFooter.vue'
import CardHeader from './CardHeader.vue'
import CardTitle from './CardTitle.vue'

const meta: Meta<typeof Card> = {
  title: 'Website/UI/Card',
  component: Card,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink mx-auto max-w-md p-8"><story /></div>'
    })
  ],
  render: () => ({
    components: {
      Button,
      Card,
      CardContent,
      CardDescription,
      CardFooter,
      CardHeader,
      CardTitle
    },
    template: `
      <Card class="overflow-hidden py-6">
        <CardHeader class="px-6">
          <CardTitle>Comfy Cloud</CardTitle>
          <CardDescription>Run production workflows without managing infrastructure.</CardDescription>
        </CardHeader>
        <CardContent><div class="bg-primary-comfy-plum h-36 rounded-3xl" aria-hidden="true" /></CardContent>
        <CardFooter class="px-6"><Button href="#learn-more">Learn more</Button></CardFooter>
      </Card>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = {
  render: () => ({
    components: { Card, CardContent, CardTitle },
    template:
      '<Card class="gap-3 p-6"><CardTitle>API</CardTitle><CardContent class="px-0">Build with Comfy workflows.</CardContent></Card>'
  })
}
