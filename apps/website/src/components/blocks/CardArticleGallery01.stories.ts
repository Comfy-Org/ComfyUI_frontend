import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardArticleGallery01 from './CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from './CardArticleGallery01.vue'

const sampleImage =
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80'

function item(
  id: string,
  title: string,
  filterKey?: string
): CardArticleGalleryItem {
  return {
    id,
    category: filterKey
      ? filterKey.charAt(0).toUpperCase() + filterKey.slice(1)
      : 'Platform',
    title,
    media: { type: 'image', src: sampleImage, alt: title },
    cta: { label: 'WATCH NOW', href: '#' },
    filterKey
  }
}

const meta: Meta<typeof CardArticleGallery01> = {
  title: 'Website/Blocks/CardArticleGallery01',
  component: CardArticleGallery01,
  tags: ['autodocs'],
  args: {
    title: 'See our past events',
    titleAlign: 'center',
    layout: 'two-column',
    items: [
      item('a', 'Run ComfyUI From Claude/Cursor with Comfy MCP', 'livestream'),
      item('b', 'Reinventing the Production Pipeline', 'livestream'),
      item('c', 'Comfy Spring Hackathon: Winning Projects', 'hackathon'),
      item('d', 'Comfy Community Meetup: Tokyo', 'community'),
      item('e', 'Krea X Comfy: Founders Live', 'livestream'),
      item('f', 'June Launches | Desktop, MCP & Core Engine', 'livestream')
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithTabsAndLoadMore: Story = {
  args: {
    titleClamp: true,
    tabs: [
      { key: 'livestream', label: 'Livestream' },
      { key: 'hackathon', label: 'Hackathon' },
      { key: 'community', label: 'Community' }
    ],
    allLabel: 'ALL',
    pageSize: 4,
    loadMoreLabel: 'LOAD MORE'
  }
}

export const MixedLayout: Story = {
  args: {
    title: 'Latest Launches',
    titleAlign: 'start',
    layout: 'mixed',
    items: [
      {
        ...item('a', 'New Desktop Client'),
        badge: 'NEW',
        description:
          'A faster, redesigned desktop app for ComfyUI — one-click install and managed updates.',
        cta: { label: 'EXPLORE', href: '#' }
      },
      ...['b', 'c', 'd', 'e', 'f'].map((id) => ({
        ...item(id, `Launch ${id.toUpperCase()}`),
        description: 'Launch description goes here.',
        cta: { label: 'EXPLORE', href: '#' }
      }))
    ]
  }
}
