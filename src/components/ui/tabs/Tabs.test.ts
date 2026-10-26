import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { ref } from 'vue'

import Tabs from './Tabs.vue'
import TabsContent from './TabsContent.vue'
import TabsList from './TabsList.vue'
import TabsTrigger from './TabsTrigger.vue'

it('keeps selection, labeled panels, and the caller model in sync while disabled tabs stay unavailable', async () => {
  const selected = ref('details')
  render({
    components: { Tabs, TabsContent, TabsList, TabsTrigger },
    setup: () => ({ selected }),
    template: `
      <Tabs v-model="selected">
        <TabsList aria-label="Item views">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="restricted" disabled>Restricted</TabsTrigger>
        </TabsList>
        <TabsContent value="details">Item details</TabsContent>
        <TabsContent value="history">Previous changes</TabsContent>
        <TabsContent value="restricted">Unavailable content</TabsContent>
      </Tabs>
    `
  })

  expect(screen.getByRole('tabpanel', { name: 'Details' })).toHaveTextContent(
    'Item details'
  )
  await userEvent.click(screen.getByRole('tab', { name: 'History' }))

  expect(selected.value).toBe('history')
  expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('tabpanel', { name: 'History' })).toHaveTextContent(
    'Previous changes'
  )
  expect(
    screen.queryByRole('tabpanel', { name: 'Details' })
  ).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: 'Restricted' }))
  expect(selected.value).toBe('history')
  expect(screen.queryByText('Unavailable content')).not.toBeInTheDocument()
})
