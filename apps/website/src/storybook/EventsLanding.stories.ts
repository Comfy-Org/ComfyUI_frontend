import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardArticleGallery01 from '../components/blocks/CardArticleGallery01.vue'
import CtaBands01 from '../components/blocks/CtaBands01.vue'
import FeaturedCarousel01 from '../components/blocks/FeaturedCarousel01.vue'
import HeroCentered01 from '../components/blocks/HeroCentered01.vue'

const featuredImage = '/images/mcp/mcp-thumb-keyart.webp'
const articleImage = '/images/mcp/mcp-thumb-concepts.webp'

const meta = {
  title: 'Website/Compositions/EventsLanding',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An isolated design preview assembled only from shipped website blocks. It demonstrates hierarchy and responsive composition without creating a production route or connecting live data.'
      }
    }
  },
  render: () => ({
    components: {
      CardArticleGallery01,
      CtaBands01,
      FeaturedCarousel01,
      HeroCentered01
    },
    setup() {
      const slides = [
        {
          id: 'featured-event',
          media: {
            type: 'image' as const,
            src: featuredImage,
            alt: 'Abstract Comfy artwork'
          },
          eyebrow: 'UPCOMING LIVESTREAM',
          title: 'Open models in production'
        }
      ]
      const items = [
        'Building production-ready workflows',
        'Community models and custom nodes',
        'Creative pipelines with Comfy MCP',
        'From prototype to final delivery'
      ].map((title, index) => ({
        id: `event-${index + 1}`,
        category: index % 2 === 0 ? 'Livestream' : 'Community',
        filterKey: index % 2 === 0 ? 'livestream' : 'community',
        title,
        media: {
          type: 'image' as const,
          src: articleImage,
          alt: ''
        },
        cta: { label: 'Watch now', href: `/events/example-${index + 1}` }
      }))
      const bands = [
        {
          id: 'community',
          label: 'For the community',
          text: 'Share what you build and learn from creators around the world.',
          cta: { label: 'Explore events', href: '/events' }
        }
      ]

      return { bands, items, slides }
    },
    template: `
      <main class="bg-primary-comfy-ink">
        <HeroCentered01
          eyebrow="EVENTS"
          title="Creators, all in one place"
          subtitle="Livestreams, workshops, and community events for people building with Comfy."
        />
        <FeaturedCarousel01
          :slides="slides"
          prev-label="Previous featured event"
          next-label="Next featured event"
        />
        <CardArticleGallery01
          title="Past events"
          title-align="center"
          layout="two-column"
          :items="items"
          :tabs="[
            { key: 'livestream', label: 'Livestream' },
            { key: 'community', label: 'Community' }
          ]"
          all-label="All"
        />
        <CtaBands01 :bands="bands" />
      </main>
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
