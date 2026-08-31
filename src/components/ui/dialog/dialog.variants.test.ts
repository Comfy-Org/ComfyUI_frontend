import { describe, expect, it } from 'vitest'

import { FOR_STORIES, dialogContentVariants } from './dialog.variants'

const INSET_TERM = 'var(--workspace-inset-right,0px)'

describe('dialog width caps carry the workspace inset', () => {
  it.for(FOR_STORIES.sizes)('size variant %s', (size) => {
    expect(dialogContentVariants({ size, maximized: true })).toContain(
      INSET_TERM
    )
  })

  it('centers non-maximized dialogs against the workspace inset', () => {
    expect(dialogContentVariants({ maximized: false })).toContain(
      `left-[calc(50%-${INSET_TERM}/2)]`
    )
  })

  it.fails('V1-REG-07: subtracts the published inset from the non-maximized viewport width; remove .fails when the dialog width consumes the inset', () => {
    expect(dialogContentVariants({ maximized: false })).toContain(
      `w-[calc(100vw-${INSET_TERM}-1rem)]`
    )
  })
})
