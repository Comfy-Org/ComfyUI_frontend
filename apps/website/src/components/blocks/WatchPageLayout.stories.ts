import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WatchAuthorCard from './WatchAuthorCard.vue'
import WatchChapterStrip from './WatchChapterStrip.vue'
import WatchPageLayout from './WatchPageLayout.vue'
import WatchRecommendedCard from './WatchRecommendedCard.vue'

const poster =
  'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg'

const meta: Meta<typeof WatchPageLayout> = {
  title: 'Website/Blocks/WatchPageLayout',
  component: WatchPageLayout,
  tags: ['autodocs'],
  args: {
    breadcrumbs: [
      { label: 'Home', href: '#' },
      { label: 'Learning', href: '#' },
      { label: 'Title here' }
    ],
    breadcrumbsLabel: 'Breadcrumb',
    eyebrow: 'Now watching',
    eyebrowDetail: 'Episode 1',
    title: 'Title here',
    description:
      'Lorem ipsum dolor sit amet consectetur. Arcu enim feugiat eget scelerisque egestas. Diam ut nulla augue fermentum urna. A ornare urna morbi elementum ut ut. Vitae semper massa nibh ut consectetur vestibulum libero lorem a. Aliquet malesuada in quis faucibus egestas porttitor. Adipiscing tortor sagittis aliquet euismod donec. Imperdiet massa neque blandit dolor congue amet.',
    readMoreLabel: 'Read more',
    readLessLabel: 'Read less'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: {
      WatchPageLayout,
      WatchAuthorCard,
      WatchChapterStrip,
      WatchRecommendedCard
    },
    setup: () => ({ args, poster }),
    template: `
      <WatchPageLayout v-bind="args">
        <div class="aspect-video w-full rounded-4xl bg-white/10" />
        <template #author>
          <WatchAuthorCard name="Author / Studio name" detail="Studio · 1.2M subscribers" />
        </template>
        <template #chapters>
          <WatchChapterStrip
            heading="Chapter"
            :items="[
              { id: 'e2', label: 'Episode 2', href: '#', poster },
              { id: 'e3', label: 'Episode 3', href: '#', poster }
            ]"
          />
        </template>
        <template #sidebar>
          <h2 class="text-primary-warm-gray font-medium">Recommended</h2>
          <div class="mt-4 flex flex-col gap-8">
            <WatchRecommendedCard
              v-for="tag in ['Action', 'Comedy', 'Suspense']"
              :key="tag"
              :item="{
                id: tag,
                title: 'Huntress’s Tale Title here',
                credit: 'Creator credit',
                tag,
                href: '#',
                poster
              }"
            />
          </div>
        </template>
      </WatchPageLayout>
    `
  })
}

export const TitleOnly: Story = {
  args: {
    breadcrumbs: [],
    eyebrow: undefined,
    eyebrowDetail: undefined,
    description: undefined
  },
  render: (args) => ({
    components: { WatchPageLayout },
    setup: () => ({ args }),
    template: `
      <WatchPageLayout v-bind="args">
        <div class="aspect-video w-full rounded-4xl bg-white/10" />
      </WatchPageLayout>
    `
  })
}
