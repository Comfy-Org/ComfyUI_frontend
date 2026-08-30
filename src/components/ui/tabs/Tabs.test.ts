import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '.'

describe('Tabs', () => {
  it('selects tabs and displays their content', async () => {
    render({
      components: { Tabs, TabsContent, TabsList, TabsTrigger },
      template: `
        <Tabs default-value="first">
          <TabsList>
            <TabsTrigger value="first">First</TabsTrigger>
            <TabsTrigger value="second">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="first">First content</TabsContent>
          <TabsContent value="second">Second content</TabsContent>
        </Tabs>
      `
    })
    const user = userEvent.setup()

    expect(screen.getByText('First content')).toBeVisible()
    expect(screen.queryByText('Second content')).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Second' }))
    expect(screen.getByText('Second content')).toBeVisible()
    expect(screen.queryByText('First content')).toBeNull()
  })
})
