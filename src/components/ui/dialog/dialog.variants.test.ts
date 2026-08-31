import { describe, expect, it } from 'vitest'

import * as dialogVariants from './dialog.variants'

const { FOR_STORIES, dialogContentVariants } = dialogVariants
const { HUG_CONTENT_CLASS, viewerDialogContentClass } =
  dialogVariants as typeof dialogVariants & {
    HUG_CONTENT_CLASS: string
    viewerDialogContentClass: string
  }

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

  it.fails('non-maximized placement centers and sizes against the inset', () => {
    // W10 baseline expected failure: this exhaustive-QA slice assertion fails
    // on main@f954e479 because width still omits the workspace inset term.
    const classes = dialogContentVariants({ maximized: false })

    expect(classes).toContain(`left-[calc(50%-${INSET_TERM}/2)]`)
    expect(classes).toContain(`w-[calc(100vw-${INSET_TERM}-1rem)]`)
  })

  it.fails('the shared viewer class caps against the inset', () => {
    // W10 baseline expected failure: main@f954e479 does not export this
    // shared viewer class from the dialog variants module.
    expect(viewerDialogContentClass).toContain(
      `sm:max-w-[min(80vw,calc(100vw-${INSET_TERM}-1rem))]`
    )
  })

  it.fails('the hug class caps against the inset at both breakpoints', () => {
    // W10 baseline expected failure: main@f954e479 does not expose the slice's
    // shared hug token, so upload dialogs still carry an inline width cap.
    const occurrences = HUG_CONTENT_CLASS.split(INSET_TERM).length - 1
    expect(occurrences).toBe(2)
  })
})
