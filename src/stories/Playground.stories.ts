// A blank composition canvas for one-off prototyping with the ComfyUI design
// system -- real ui/* Vue components, real Tailwind/token build, real Reka UI
// behavior. Overwrite this file freely; it's meant to be rewritten per
// prototype, not accumulated. For a growing library of reusable, persistent
// compositions instead, see src/stories/templates/ (Templates/* in the
// Storybook sidebar) -- start there, or copy one of those files, if what
// you're building is meant to stick around.
//
// Before editing, read .claude/skills/design-system/SKILL.md -- it documents
// every component and pattern available under src/components/ui/*, plus the
// coexisting non-ui/ patterns (Tab/TabList, BatchCountEdit, SidebarIcon) found
// in the real app.
//
// To use: run `pnpm storybook`, open "Playground/Design System", and edit the
// render() below (or ask an agent to -- point it at this file and the skill).

import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

const meta: Meta = {
  title: 'Playground/Design System',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A blank composition canvas -- overwrite the render() in Playground.stories.ts with whatever you're prototyping. See .claude/skills/design-system/SKILL.md for the component/pattern reference, and src/stories/templates/ for a library of persistent starting points."
      }
    }
  }
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-col gap-3 p-6">
        <p class="max-w-md text-sm text-muted-foreground">
          Empty canvas. Import components from <code>@/components/ui/*</code>
          above, add them to <code>components</code>, and build the
          <code>template</code> below.
        </p>
        <Button variant="primary" class="w-fit">Replace me</Button>
      </div>
    `
  })
}
