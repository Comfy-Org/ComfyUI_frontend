import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import Dialog from './Dialog.vue'
import DialogContent from './DialogContent.vue'

async function open(props: { closeLabel: string; hideClose?: boolean }) {
  const view = render(Dialog, {
    props: { defaultOpen: true },
    slots: { default: () => h(DialogContent, props, () => 'Body') }
  })
  await nextTick()
  return view
}

describe('DialogContent', () => {
  it('offers a corner cross that says what it does', async () => {
    await open({ closeLabel: 'Close this' })

    expect(screen.getByRole('button', { name: 'Close this' })).toBeTruthy()
    expect(screen.getByText('Body')).toBeTruthy()
  })

  // A confirm whose two buttons are the only two answers would otherwise
  // carry a third control meaning the same as one of them.
  it('leaves the cross out when the dialog asks for it', async () => {
    await open({ closeLabel: 'Close this', hideClose: true })

    expect(screen.queryByRole('button', { name: 'Close this' })).toBeNull()
    expect(screen.getByText('Body')).toBeTruthy()
  })
})
