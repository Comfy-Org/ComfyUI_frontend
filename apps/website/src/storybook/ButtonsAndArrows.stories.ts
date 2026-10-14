import { ArrowRight, ArrowUpRight, ChevronDown } from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '@/components/common/BrandButton.vue'
import CardRow from '@/components/workshop/CardRow.vue'

import Button from '@/components/ui/button/Button.vue'

const rule = `
Which icon goes on a button or link depends on where it takes the visitor.

| Element | Icon | Use it when | Examples |
| --- | --- | --- | --- |
| CTA button | none | Any call to action. UPPERCASE label, \`BrandButton\` or \`ui/button\` \`Button\` with an existing variant. | GET AN API KEY, RUN, TRY IN COMFY CLOUD, BROWSE ALL MODELS |
| Text link | → \`ArrowRight\` | Goes to another page on comfy.org. | Explore the Hub →, See all → |
| Text link | ↗ \`ArrowUpRight\` | Leaves comfy.org or opens a new tab. When it opens a new tab, add sr-only "(opens in a new tab)". | GitHub ↗, Docs ↗ |
| Prev / next, separators, back | › ‹ \`ChevronRight\` / \`ChevronLeft\` | Moves within the same place, no new page. | Row or carousel prev/next, breadcrumb separators, mobile "‹ Models", mobile submenu drill-in |
| Disclosure trigger | ⌄ \`ChevronDown\` | Opens something in place. Rotates when open. | Dropdowns, filters, disclosures, folds |

**Don't** put an arrow or a chevron on a CTA button. Arrows belong to text links only.

**Row and carousel arrows** (\`CardRow\`): ‹ › sit on the left and right edges of the row, half over the cards and half over the page, centred vertically. They are neutral (dark fill, light border), never yellow: the yellow belongs to See all. They appear while the row is hovered or focused, dim when that end is reached, and are hidden on touch screens, where the reader swipes.
`

const meta: Meta = {
  title: 'Website/Guidelines/Buttons and arrows',
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: rule } }
  },
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const CtaButtons: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Do: CTA buttons carry no icon and an UPPERCASE label. Use the existing `BrandButton` and `Button` variants.'
      }
    }
  },
  render: () => ({
    components: { BrandButton, Button },
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <BrandButton href="#" variant="solid">GET AN API KEY</BrandButton>
        <BrandButton href="#" variant="outline">TRY IN COMFY CLOUD</BrandButton>
        <Button>RUN</Button>
        <Button href="#" variant="secondaryOutline">BROWSE ALL MODELS</Button>
      </div>
    `
  })
}

export const InternalTextLink: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A text link to another page on comfy.org ends with →.'
      }
    }
  },
  render: () => ({
    components: { Button, ArrowRight },
    template: `
      <div class="flex flex-wrap items-center gap-8">
        <Button href="#" variant="underlineLink" size="sm">
          Explore the Hub
          <template #append><ArrowRight class="size-4" aria-hidden="true" /></template>
        </Button>
        <Button href="#" variant="underlineLink" size="sm">
          See all
          <template #append><ArrowRight class="size-4" aria-hidden="true" /></template>
        </Button>
      </div>
    `
  })
}

export const ExternalTextLink: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A text link that leaves comfy.org or opens a new tab ends with ↗ and carries sr-only "(opens in a new tab)" text.'
      }
    }
  },
  render: () => ({
    components: { Button, ArrowUpRight },
    template: `
      <Button
        href="https://github.com/Comfy-Org/ComfyUI"
        target="_blank"
        rel="noopener noreferrer"
        variant="underlineLink"
        size="sm"
      >
        View on GitHub
        <span class="sr-only">(opens in a new tab)</span>
        <template #append><ArrowUpRight class="size-4" aria-hidden="true" /></template>
      </Button>
    `
  })
}

export const ChevronPrevNext: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Row prev and next use ‹ and › on the row edges. Hover the row to reveal them; the left one starts dimmed because the row is at its start.'
      }
    }
  },
  render: () => ({
    components: { CardRow },
    setup: () => ({
      cards: Array.from({ length: 8 }, (_, index) => index + 1)
    }),
    template: `
      <div class="px-6">
        <CardRow>
          <template #heading>
            <h3 class="text-xl font-semibold text-primary-warm-white">Popular models</h3>
          </template>
          <li
            v-for="card in cards"
            :key="card"
            class="h-40 w-64 shrink-0 snap-start rounded-2xl bg-transparency-white-t8"
          />
        </CardRow>
      </div>
    `
  })
}

export const DisclosureTrigger: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A trigger that opens something in place ends with ⌄, which rotates while open.'
      }
    }
  },
  render: () => ({
    components: { Button, ChevronDown },
    setup() {
      const open = ref(false)
      return { open, cn }
    },
    template: `
      <div class="flex flex-col items-start gap-4">
        <Button
          variant="ghost"
          :aria-expanded="open"
          aria-controls="guide-disclosure"
          @click="open = !open"
        >
          Filters
          <template #append>
            <ChevronDown
              :class="cn('size-4 transition-transform', open && 'rotate-180')"
              aria-hidden="true"
            />
          </template>
        </Button>
        <p v-show="open" id="guide-disclosure" class="text-sm text-primary-comfy-canvas">
          Content opens in place.
        </p>
      </div>
    `
  })
}

export const DontArrowOnCta: Story = {
  name: "Don't: arrow on a CTA",
  parameters: {
    docs: {
      description: {
        story:
          'Incorrect. A CTA button never carries an arrow or a chevron. Remove the icon and keep the UPPERCASE label.'
      }
    }
  },
  render: () => ({
    components: { BrandButton, ArrowRight },
    template: `
      <div class="flex flex-col items-start gap-3">
        <span class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase">
          Incorrect
        </span>
        <BrandButton href="#" variant="solid">
          GET AN API KEY
          <ArrowRight class="ml-2 size-4" aria-hidden="true" />
        </BrandButton>
      </div>
    `
  })
}
