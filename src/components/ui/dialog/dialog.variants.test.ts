import { describe, expect, it } from 'vitest'

import {
  FOR_STORIES,
  HUG_CONTENT_CLASS,
  dialogContentVariants,
  viewerDialogContentClass
} from './dialog.variants'

/**
 * A right-docked surface reserves screen width by publishing
 * `--workspace-inset-right` (see `useWorkspaceInset`). Every dialog surface
 * that constrains width or horizontal placement has to subtract that term, or
 * the dialog renders underneath the docked panel. Layout itself is not
 * observable under happy-dom, so this asserts the inset term reaches each
 * surface; the rendered bounds need an e2e case.
 */
const INSET_TERM = 'var(--workspace-inset-right,0px)'

const insetAwareSurfaces: ReadonlyArray<readonly [string, string]> = [
  ...FOR_STORIES.sizes.map(
    (size) =>
      [
        `size ${size} cap`,
        // maximized:true carries no inset term, so the size cap is the only source.
        dialogContentVariants({ size, maximized: true })
      ] as const
  ),
  ['shared viewer cap', viewerDialogContentClass],
  ['hug cap', HUG_CONTENT_CLASS]
]

const insetBearingUtilities = (classes: string) =>
  classes.split(' ').filter((utility) => utility.includes(INSET_TERM))

describe('dialog surfaces reserve the workspace inset', () => {
  it.for(insetAwareSurfaces)('%s', ([, classes]) => {
    expect(classes).toContain(INSET_TERM)
  })

  it('centered placement reserves the inset in both offset and width', () => {
    const utilities = insetBearingUtilities(
      dialogContentVariants({ maximized: false })
    )

    expect(
      utilities.filter((utility) => utility.startsWith('left-')),
      'centering against the full viewport pushes the dialog under a right-docked surface'
    ).toHaveLength(1)
    expect(
      utilities.filter((utility) => utility.startsWith('w-')),
      'sizing against the full viewport overflows past a right-docked surface'
    ).toHaveLength(1)
  })
})
