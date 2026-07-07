// @vitest-environment jsdom
// Reka's Dialog teleports its content to document.body; jsdom serializes the portalled
// tree reliably, so this integration smoke test (that the primitive wiring mounts and
// opens) runs against jsdom rather than happy-dom.
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { DialogRoot, DialogTrigger } from 'reka-ui'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import Button from './Button.vue'
import DialogContent from './DialogContent.vue'

describe('ui primitives wiring', () => {
  it('Button renders its slot and reacts to clicks', async () => {
    let clicks = 0
    render(
      defineComponent(
        () => () => h(Button, { onClick: () => (clicks += 1) }, () => 'Send')
      )
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(clicks).toBe(1)
  })

  it('Dialog opens from its trigger and shows portalled content + close', async () => {
    render(
      defineComponent(
        () => () =>
          h(DialogRoot, null, () => [
            h(DialogTrigger, null, () => 'Open'),
            h(DialogContent, null, () => 'Body copy')
          ])
      ),
      { global: { plugins: [i18n] } }
    )
    expect(screen.queryByText('Body copy')).toBeNull()
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Body copy')).toBeTruthy()
    expect(screen.getByLabelText('Close')).toBeTruthy()
  })
})
