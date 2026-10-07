import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '@/components/common/BrandButton.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'

import Button from './Button.vue'

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
        <Button href="#" variant="outline">BROWSE ALL MODELS</Button>
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
          'Prev and next controls move within the same place, so they use ‹ and ›. Each icon-only button has an aria-label.'
      }
    }
  },
  render: () => ({
    components: { IconButton, ChevronLeft, ChevronRight },
    template: `
      <div class="flex gap-4">
        <IconButton variant="outline" aria-label="Previous">
          <ChevronLeft class="size-5" aria-hidden="true" />
        </IconButton>
        <IconButton variant="outline" aria-label="Next">
          <ChevronRight class="size-5" aria-hidden="true" />
        </IconButton>
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
