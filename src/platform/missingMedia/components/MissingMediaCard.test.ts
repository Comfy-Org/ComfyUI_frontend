import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import MissingMediaCard from './MissingMediaCard.vue'

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: vi.fn()
}))

describe('MissingMediaCard', () => {
  it('preserves special characters in the locate button accessible name', () => {
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      createMockLGraphNode({ title: 'A & B <C>' })
    )
    const missingMediaGroups: MissingMediaGroup[] = [
      {
        mediaType: 'image',
        items: [
          {
            name: 'image.png',
            mediaType: 'image',
            representative: {
              nodeId: '1',
              nodeType: 'LoadImage',
              widgetName: 'image',
              mediaType: 'image',
              name: 'image.png',
              isMissing: true
            },
            referencingNodes: [
              {
                nodeId: '1',
                nodeType: 'LoadImage',
                widgetName: 'image'
              }
            ]
          }
        ]
      }
    ]

    render(MissingMediaCard, {
      props: { missingMediaGroups },
      global: { plugins: [testI18n] }
    })

    expect(
      screen.getByRole('button', { name: 'Locate A & B <C> - image' })
    ).toBeInTheDocument()
    expect(screen.queryAllByLabelText(/&(?:amp|lt|gt);/)).toHaveLength(0)
  })
})
