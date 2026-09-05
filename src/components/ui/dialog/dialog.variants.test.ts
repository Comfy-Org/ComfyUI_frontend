import { describe, expect, it } from 'vitest'

import {
  FOR_STORIES,
  HUG_CONTENT_CLASS,
  dialogContentVariants,
  viewerDialogContentClass
} from './dialog.variants'

/**
 * The workspace-inset teeth: against the maximized baseline each size cap,
 * the shared viewer cap, and the hug token must carry the inset term by name.
 */
const INSET_TERM = 'var(--workspace-inset-right,0px)'

describe('dialog width caps carry the workspace inset', () => {
  it.for(FOR_STORIES.sizes)('size variant %s', (size) => {
    // maximized:true carries no inset term, so the size cap is the only source.
    expect(dialogContentVariants({ size, maximized: true })).toContain(
      INSET_TERM
    )
  })

  it('non-maximized placement centers and sizes against the inset', () => {
    const classes = dialogContentVariants({ maximized: false })

    expect(classes).toContain(`left-[calc(50%-${INSET_TERM}/2)]`)
    expect(classes).toContain(`w-[calc(100vw-${INSET_TERM}-1rem)]`)
  })

  it('the shared viewer class caps against the inset', () => {
    expect(viewerDialogContentClass).toContain(
      `sm:max-w-[min(80vw,calc(100vw-${INSET_TERM}-1rem))]`
    )
  })

  it('the hug class caps against the inset at both breakpoints', () => {
    const occurrences = HUG_CONTENT_CLASS.split(INSET_TERM).length - 1
    expect(occurrences).toBe(2)
  })
})
