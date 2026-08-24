import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CtaCenter01 from '../components/blocks/CtaCenter01.vue'
import FeatureRows01 from '../components/blocks/FeatureRows01.vue'
import HeroSplit01 from '../components/blocks/HeroSplit01.vue'
import ReasonsSplit01 from '../components/blocks/ReasonsSplit01.vue'
import HeaderMain from '../components/common/HeaderMain/HeaderMain.vue'
import SiteFooter from '../components/common/SiteFooter.vue'

const meta = {
  title: 'Website/Pages/Canonical Marketing Shell',
  tags: ['autodocs', 'experimental'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An isolated composition proving that the documented website components form a complete marketing page. It does not add a production route or data integration.'
      }
    }
  },
  render: () => ({
    components: {
      CtaCenter01,
      FeatureRows01,
      HeaderMain,
      HeroSplit01,
      ReasonsSplit01,
      SiteFooter
    },
    setup() {
      const featureRows = [
        {
          id: 'graph',
          title: 'Build in a visual graph',
          description:
            'Make every model, input, and transformation visible and reusable.',
          media: {
            type: 'image' as const,
            src: '/images/demos/community-workflows-thumb.webp',
            alt: 'A visual ComfyUI workflow'
          }
        },
        {
          id: 'templates',
          title: 'Turn experiments into systems',
          description:
            'Save proven workflows as a foundation for the next idea or teammate.',
          media: {
            type: 'image' as const,
            src: '/images/demos/workflow-templates-thumb.webp',
            alt: 'A reusable ComfyUI workflow template'
          }
        }
      ]
      const reasons = [
        {
          id: 'control',
          title: 'Control',
          description: 'Inspect and tune every step of the generation process.'
        },
        {
          id: 'reuse',
          title: 'Reuse',
          description: 'Share the process, not only the final output.'
        },
        {
          id: 'choice',
          title: 'Choice',
          description: 'Use the models and deployment path that fit the work.'
        }
      ]
      return { featureRows, reasons }
    },
    template: `
      <div class="min-h-screen bg-primary-comfy-ink">
        <HeaderMain github-stars="95k" />
        <main>
          <HeroSplit01
            badge-text="COMFYUI"
            title-highlight="Create without limits."
            title=" Build with control."
            subtitle="A visual workflow system for generative AI."
            :features="['Open and extensible', 'Local or cloud', 'Built to be shared']"
            :primary-cta="{ label: 'Download', href: '/download' }"
            :secondary-cta="{ label: 'Try Cloud', href: '/cloud' }"
            image-src="/images/mcp/mcp-thumb-keyart.webp"
            image-alt="Abstract Comfy artwork"
          />
          <FeatureRows01
            eyebrow="How it works"
            heading="From an idea to a repeatable workflow."
            :rows="featureRows"
          />
          <ReasonsSplit01
            heading="Why creators choose "
            heading-highlight="ComfyUI"
            highlight-class="text-primary-comfy-yellow"
            :reasons="reasons"
          />
          <CtaCenter01
            heading="Start building with ComfyUI."
            subtitle="Choose the path that fits your workflow."
            :primary-cta="{ label: 'Download', href: '/download' }"
            :secondary-cta="{ label: 'Try Cloud', href: '/cloud' }"
          />
        </main>
        <SiteFooter />
      </div>
    `
  })
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
