import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import NavigationMenu from './NavigationMenu.vue'
import NavigationMenuContent from './NavigationMenuContent.vue'
import NavigationMenuItem from './NavigationMenuItem.vue'
import NavigationMenuLink from './NavigationMenuLink.vue'
import NavigationMenuList from './NavigationMenuList.vue'
import NavigationMenuTrigger from './NavigationMenuTrigger.vue'

const meta: Meta<typeof NavigationMenu> = {
  title: 'Website/UI/NavigationMenu',
  component: NavigationMenu,
  tags: ['autodocs', 'stable'],
  render: (args) => ({
    components: {
      NavigationMenu,
      NavigationMenuContent,
      NavigationMenuItem,
      NavigationMenuLink,
      NavigationMenuList,
      NavigationMenuTrigger
    },
    setup: () => ({ args }),
    template: `
      <NavigationMenu v-bind="args">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Products</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div class="grid w-96 grid-cols-2 gap-2">
                <NavigationMenuLink href="#cloud"><strong>Cloud</strong><span>Run workflows anywhere.</span></NavigationMenuLink>
                <NavigationMenuLink href="#api"><strong>API</strong><span>Build with Comfy.</span></NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem><NavigationMenuLink href="#pricing">Pricing</NavigationMenuLink></NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Products' })
    await userEvent.hover(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('data-state', 'open'))
    await expect(
      canvas.getByRole('link', { name: /Cloud/ })
    ).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveAttribute('data-state', 'closed'))
  }
}
export const WithoutViewport: Story = { args: { viewport: false } }
