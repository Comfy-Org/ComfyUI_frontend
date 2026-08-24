import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardArticleGallery01 from '../components/blocks/CardArticleGallery01.vue'
import CtaCenter01 from '../components/blocks/CtaCenter01.vue'
import FAQSplit01 from '../components/blocks/FAQSplit01.vue'
import FeatureRows01 from '../components/blocks/FeatureRows01.vue'
import HeroCentered01 from '../components/blocks/HeroCentered01.vue'
import HeroSplit01 from '../components/blocks/HeroSplit01.vue'
import StepsGrid01 from '../components/blocks/StepsGrid01.vue'
import PricingSection from '../components/pricing/PricingSection.vue'

const articles = [
  'Building production-ready workflows',
  'A practical guide to reusable graphs',
  'Creative pipelines with Comfy Cloud',
  'From prototype to final delivery'
].map((title, index) => ({
  id: `article-${index + 1}`,
  category: index % 2 === 0 ? 'Workflow' : 'Guide',
  title,
  media: {
    type: 'image' as const,
    src: '/images/mcp/mcp-thumb-concepts.webp',
    alt: ''
  },
  cta: { label: 'Read more', href: `/blog/article-${index + 1}` }
}))

const steps = [
  {
    id: 'choose',
    label: 'Choose',
    description: 'Start from a model and a clear creative goal.'
  },
  {
    id: 'build',
    label: 'Build',
    description: 'Connect the approved workflow components.'
  },
  {
    id: 'refine',
    label: 'Refine',
    description: 'Tune the result without losing the graph.'
  },
  {
    id: 'ship',
    label: 'Ship',
    description: 'Run locally, in Cloud, or through the API.'
  }
]

const faqs = [
  {
    id: 'access',
    question: 'Where can I run it?',
    answer: 'Use Comfy Desktop, Comfy Cloud, or the API.'
  },
  {
    id: 'workflow',
    question: 'Can I reuse the workflow?',
    answer: 'Yes. The graph remains editable and shareable.'
  }
]

const meta = {
  title: 'Website/Recipes/Page Patterns',
  tags: ['autodocs', 'experimental'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Reference page structures for design and agent-assisted composition. Each recipe uses shipped website blocks, static fixtures, and no production routing or data integration.'
      }
    }
  }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ProductLanding: Story = {
  render: () => ({
    components: { CtaCenter01, FeatureRows01, HeroSplit01, StepsGrid01 },
    setup: () => ({ steps }),
    template: `
      <main class="bg-primary-comfy-ink">
        <HeroSplit01
          badge-text="COMFY CLOUD"
          title-highlight="Create anywhere."
          title=" Keep your workflow."
          subtitle="The complete ComfyUI experience without infrastructure setup."
          :features="['Managed compute', 'Your reusable graphs', 'Ready in the browser']"
          :primary-cta="{ label: 'Try Cloud', href: '/cloud' }"
          :secondary-cta="{ label: 'View pricing', href: '/pricing' }"
          image-src="/images/mcp/mcp-thumb-keyart.webp"
          image-alt="Abstract Comfy artwork"
        />
        <FeatureRows01
          eyebrow="How it works"
          heading="From an idea to a reusable system."
          :rows="[
            { id: 'compose', title: 'Compose visually', description: 'Connect models and operations in a graph.', media: { type: 'image', src: '/images/demos/community-workflows-thumb.webp', alt: 'A visual workflow' } },
            { id: 'scale', title: 'Run where the work happens', description: 'Keep the same workflow as the team grows.', media: { type: 'image', src: '/images/demos/workflow-templates-thumb.webp', alt: 'A reusable workflow template' } }
          ]"
        />
        <StepsGrid01 heading="From prompt to production" :steps="steps" />
        <CtaCenter01 heading="Start building in Comfy Cloud." :primary-cta="{ label: 'Try Cloud', href: '/cloud' }" />
      </main>
    `
  })
}

export const ArticleGallery: Story = {
  render: () => ({
    components: { CardArticleGallery01, CtaCenter01, HeroCentered01 },
    setup: () => ({ articles }),
    template: `
      <main class="bg-primary-comfy-ink">
        <HeroCentered01 eyebrow="LEARN" title="Ideas, workflows, and practical guides" subtitle="Explore how creators build with Comfy." />
        <CardArticleGallery01 title="Latest from Comfy" title-align="center" layout="two-column" :items="articles" />
        <CtaCenter01 heading="Build what you learned." :primary-cta="{ label: 'Get started', href: '/download' }" />
      </main>
    `
  })
}

export const Pricing: Story = {
  render: () => ({
    components: { CtaCenter01, PricingSection },
    template: `
      <main class="bg-primary-comfy-ink">
        <PricingSection />
        <CtaCenter01 heading="Need a plan for your team?" subtitle="Talk with us about production workflows and enterprise deployment." :primary-cta="{ label: 'Contact us', href: '/contact' }" />
      </main>
    `
  })
}

export const Event: Story = {
  render: () => ({
    components: { CardArticleGallery01, HeroCentered01 },
    setup: () => ({ articles }),
    template: `
      <main class="bg-primary-comfy-ink">
        <HeroCentered01 eyebrow="EVENTS" title="Creators, all in one place" subtitle="Livestreams, workshops, and community events." />
        <CardArticleGallery01 title="Upcoming and recent events" title-align="center" layout="two-column" :items="articles" :tabs="[{ key: 'workflow', label: 'Livestreams' }, { key: 'guide', label: 'Community' }]" all-label="All" />
      </main>
    `
  })
}

export const ModelLaunch: Story = {
  render: () => ({
    components: { CtaCenter01, FAQSplit01, HeroSplit01, StepsGrid01 },
    setup: () => ({ faqs, steps }),
    template: `
      <main class="bg-primary-comfy-ink">
        <HeroSplit01
          badge-text="NEW MODEL"
          title-highlight="A new way to create."
          title=" Ready in ComfyUI."
          subtitle="Explore the model, understand the workflow, and choose where to run it."
          :features="['Official workflow', 'Local and Cloud options', 'Editable from end to end']"
          :primary-cta="{ label: 'Run in Cloud', href: '/cloud' }"
          :secondary-cta="{ label: 'Download workflow', href: '/download' }"
          image-src="/images/mcp/mcp-thumb-moodboard.webp"
          image-alt="Generated model artwork"
        />
        <StepsGrid01 heading="Run the model in four steps" :steps="steps" />
        <FAQSplit01 heading="About this model" :faqs="faqs" />
        <CtaCenter01 heading="Try the official workflow." :primary-cta="{ label: 'Run in Cloud', href: '/cloud' }" />
      </main>
    `
  })
}
