import type { Meta, StoryObj } from '@storybook/vue3-vite'

const proposals = `
Patterns the Hub needs that the catalog does not cover yet. Each one is a
proposal for review, not an approved component. Until a proposal is accepted,
pages keep their current local implementation and do not invent new variants.

| Proposal | Gap in the catalog | Where it is needed |
| --- | --- | --- |
| Tabs | \`ToggleGroup\` groups toggle buttons; it does not link a tab to a panel with tab roles and arrow-key focus. | Workflow files panel (Comfy Cloud / Your machine), code-language tabs, model category tabs |
| Inline breadcrumb | \`BreadcrumbBar\` is a full-width page bar only. No inline layout, no truncation of a long last item, no mobile back-link collapse. | Hub list and detail pages |
| Overlay and kind badges | \`Badge\` has no variant for artwork overlays, no colour per content kind with an icon, and no link chip with a hover state. | Card type badges, explore result kind tags, model tag chips |
| Link card | \`Card\` cannot be the link itself, has no hover state and no media inset layout. | Model, workflow and app cards |
| Lightbox dialog | \`Dialog\` has no full-screen media variant. | Output and sample previews |
| Muted text button and scrim icon button | \`Button\` has no muted grey text style; \`IconButton\` has no variant for a dark scrim over media. | Compare tray "Clear", media expand and collapse controls |
| Partial fold | \`Accordion\` hides its content completely; it cannot keep a preview visible behind a "show more" toggle. | API code panel graph fold |
| Category navigation | \`CategoryNav\` has a hard-coded English label and no icons. | Catalogue filters |
`

const meta: Meta = {
  title: 'Website/Guidelines/Proposed components',
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: proposals } }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Status: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every row above is open for review. Accepted proposals become catalogued components with their own stories.'
      }
    }
  },
  render: () => ({
    template: `
      <p class="bg-primary-comfy-ink p-8 text-sm text-primary-comfy-canvas">
        Proposals only. No component on this page is approved yet.
      </p>
    `
  })
}
