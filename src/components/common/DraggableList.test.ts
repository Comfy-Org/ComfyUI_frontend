import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { ref } from 'vue'

import DraggableList from './DraggableList.vue'

it('commits the dragged order to the caller model and rendered slots on release', async () => {
  const items = ref(['Alpha', 'Beta'])
  render({
    components: { DraggableList },
    setup: () => ({ items }),
    template: `
      <DraggableList v-model="items" v-slot="{ dragClass }">
        <button v-for="item in items" :key="item" :class="dragClass">{{ item }}</button>
      </DraggableList>
    `
  })
  const alpha = screen.getByRole('button', { name: 'Alpha' })
  const beta = screen.getByRole('button', { name: 'Beta' })
  const alphaRect = vi
    .spyOn(alpha, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 100, 20))
  vi.spyOn(beta, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 20, 100, 20)
  )

  const user = userEvent.setup()
  await user.pointer({
    target: alpha,
    keys: '[MouseLeft>]',
    coords: { clientY: 10 }
  })
  alphaRect.mockReturnValue(new DOMRect(0, 25, 100, 20))
  await user.pointer({ target: alpha, coords: { clientY: 35 } })
  expect(items.value).toEqual(['Alpha', 'Beta'])
  await user.pointer({ keys: '[/MouseLeft]' })
  expect(items.value).toEqual(['Beta', 'Alpha'])
  expect(screen.getAllByRole('button').map((item) => item.textContent)).toEqual(
    ['Beta', 'Alpha']
  )
})
