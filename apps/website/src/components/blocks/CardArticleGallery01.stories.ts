import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import CardArticleGallery01 from './CardArticleGallery01.vue'
import type { CardArticleGalleryItem } from './CardArticleGallery01.vue'

const sampleImage = '/images/mcp/mcp-thumb-keyart.webp'

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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('link')).toHaveLength(4)
    await userEvent.click(canvas.getByRole('button', { name: 'LOAD MORE' }))
    await expect(canvas.getAllByRole('link')).toHaveLength(6)
    await userEvent.click(canvas.getByRole('button', { name: 'Hackathon' }))
    await expect(canvas.getAllByRole('link')).toHaveLength(1)
    await expect(
      canvas.getByText('Comfy Spring Hackathon: Winning Projects')
    ).toBeVisible()
  }
}

export const ThreeColumnWithAuthors: Story = {
  args: {
    title: 'Past projects',
    titleAlign: 'center',
    layout: 'three-column',
    items: ['Advertisement', 'Entertainment', 'Ecommerce'].flatMap((category) =>
      [0, 1].map((row) => ({
        ...item(`${category}-${row}`, 'Title of the project'),
        category,
        author: {
          name: 'Person McPersonface',
          avatarSrc: '/assets/images/fallback-gradient-avatar.svg'
        },
        cta: { label: 'View project', href: '#' }
      }))
    )
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

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  },
  args: {
    titleClamp: true,
    layout: 'three-column'
  }
}
