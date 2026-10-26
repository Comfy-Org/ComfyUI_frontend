import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { ref } from 'vue'

import Tab from './Tab.vue'
import TabList from './TabList.vue'
import TabPanel from './TabPanel.vue'

it('moves focus without selecting and activates the matching labeled panel on Enter', async () => {
  const selected = ref('first')
  render({
    components: { Tab, TabList, TabPanel },
    setup: () => ({ selected }),
    template: `
      <TabList v-model="selected">
        <Tab value="first">First</Tab>
        <Tab value="second">Second</Tab>
      </TabList>
      <TabPanel value="first" :model-value="selected">First content</TabPanel>
      <TabPanel value="second" :model-value="selected">Second content</TabPanel>
    `
  })
  screen.getByRole('tab', { name: 'First' }).focus()
  await userEvent.keyboard('{ArrowLeft}')
  expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus()
  expect(selected.value).toBe('first')
  await userEvent.keyboard('{Enter}')
  expect(selected.value).toBe('second')
  expect(screen.getByRole('tabpanel', { name: 'Second' })).toHaveTextContent(
    'Second content'
  )
  expect(
    screen.queryByRole('tabpanel', { name: 'First' })
  ).not.toBeInTheDocument()
  await userEvent.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus()
  await userEvent.keyboard('{End}')
  expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus()
})
