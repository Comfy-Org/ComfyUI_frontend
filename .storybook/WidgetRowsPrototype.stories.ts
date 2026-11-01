import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WidgetRowsPrototype from './WidgetRowsPrototype.vue'

const meta: Meta<typeof WidgetRowsPrototype> = {
  title: 'Widgets/WidgetRowsPrototype',
  component: WidgetRowsPrototype,
  tags: ['autodocs'],
  args: {
    unified: true,
    heading: 'B · Unified widget rows',
    seedValue: 9007199254740990
  },
  parameters: { layout: 'fullscreen' }
}

export default meta
type Story = StoryObj<typeof meta>

export const WidthComparison: Story = {
  render: () => ({
    components: { WidgetRowsPrototype },
    template: `
      <main class="min-h-screen bg-base-background p-8 font-inter text-foreground">
        <h1 class="mb-2 text-lg font-semibold" v-text="'B — One surface, value first'" />
        <p class="mb-8 text-sm text-muted-foreground" v-text="'Fixed edge controls · aligned labels · seed mode in the gap · labels yield completely before values truncate'" />
        <div class="flex flex-wrap items-start gap-8">
          <div class="w-[360px]" data-testid="current-normal">
            <p class="mb-3 text-xs text-muted-foreground" v-text="'CURRENT / 360 PX'" />
            <WidgetRowsPrototype :unified="false" heading="Current · External labels" />
          </div>
          <div class="w-[360px]" data-testid="unified-normal">
            <p class="mb-3 text-xs text-muted-foreground" v-text="'B / 360 PX'" />
            <WidgetRowsPrototype heading="B · Unified widget rows" />
          </div>
          <div class="w-[240px]" data-testid="unified-narrow">
            <p class="mb-3 text-xs text-muted-foreground" v-text="'B / 240 PX'" />
            <WidgetRowsPrototype heading="B · Unified widget rows" />
          </div>
          <div class="w-[200px]" data-testid="unified-tight">
            <p class="mb-3 text-xs text-muted-foreground" v-text="'B / 200 PX'" />
            <WidgetRowsPrototype heading="B · Unified widget rows" />
          </div>
        </div>
      </main>
    `
  })
}
