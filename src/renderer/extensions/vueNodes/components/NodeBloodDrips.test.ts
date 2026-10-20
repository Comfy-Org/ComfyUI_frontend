import { render, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import NodeBloodDrips from './NodeBloodDrips.vue'

it('varies drops between nodes without reshuffling on updates', async () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.1)
  const firstContainer = document.createElement('div')
  const first = render(NodeBloodDrips, { container: firstContainer })
  const firstDrops = within(firstContainer).getAllByTestId('node-blood-drop')
  const initialStyles = firstDrops.map((drop) => drop.getAttribute('style'))

  random.mockReturnValue(0.9)
  const secondContainer = document.createElement('div')
  render(NodeBloodDrips, { container: secondContainer })
  const secondDrops = within(secondContainer).getAllByTestId('node-blood-drop')

  expect(secondDrops.map((drop) => drop.style.left)).not.toEqual(
    firstDrops.map((drop) => drop.style.left)
  )
  expect(secondDrops.map((drop) => drop.style.animationDuration)).not.toEqual(
    firstDrops.map((drop) => drop.style.animationDuration)
  )
  expect(secondDrops.map((drop) => drop.style.animationDelay)).not.toEqual(
    firstDrops.map((drop) => drop.style.animationDelay)
  )

  await first.rerender({ class: 'updated-node' })
  expect(
    within(firstContainer)
      .getAllByTestId('node-blood-drop')
      .map((drop) => drop.getAttribute('style'))
  ).toEqual(initialStyles)
})
