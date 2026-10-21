import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  args: { surface: 'background' },
  argTypes: {
    surface: { control: 'select', options: ['background', 'secondary'] }
  },
  render: (args) => ({
    components: { Button, Card, CardFooter, CardHeader },
    setup: () => ({ args }),
    template: `
      <Card v-bind="args" class="w-80">
        <CardHeader>
          <h2 class="m-0 text-sm font-normal">Workspace</h2>
        </CardHeader>
        <p class="m-0 p-4 text-sm text-muted-foreground">
          Members of this workspace share its credits and workflows.
        </p>
        <CardFooter>
          <Button variant="muted-textonly">Cancel</Button>
          <Button variant="primary" size="lg">Save</Button>
        </CardFooter>
      </Card>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
