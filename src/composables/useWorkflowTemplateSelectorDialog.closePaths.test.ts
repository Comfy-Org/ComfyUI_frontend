/**
 * One test per path by which the template library can leave the screen.
 *
 * `app:template_library_closed` used to be emitted by the dialog's content
 * component, so only the two paths that run through its own UI emitted anything
 * — every dismissal was silent and the event was a floor on closes with
 * unquantified slack. These tests pin each path against the *real* dialog store
 * and the real `showLayoutDialog`, because the defect was in the seam between
 * them and a mocked store cannot show it.
 *
 * Escape, an overlay press and a focus-outside dismissal are not simulated
 * through Reka here: all three reach the store through GlobalDialog's single
 * `@update:open` handler, which is `if (!open) dialogStore.closeDialog({ key })`
 * and nothing else. So they are one test on that call, plus a test that the
 * dialog is actually configured to dismiss that way — asserting the config is
 * what stops a later `closable: false` from making them unreachable while the
 * close test still passes.
 *
 * Note the template-pick path: `loadWorkflowTemplate` closes the dialog through
 * a bare `dialogStore.closeDialog()` of its own, before the content component
 * resumes. It is indistinguishable from a dismissal at the store, which is why
 * the pick is attributed before the await rather than after it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { TemplateLibraryClosedMetadata } from '@/platform/telemetry/types'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'

const mockNewUserService = vi.hoisted(() => ({ isNewUser: vi.fn() }))

vi.mock<unknown>(import('@/services/useNewUserService'), () => ({
  useNewUserService: () => mockNewUserService
}))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'),
  () => ({ default: { name: 'MockWorkflowTemplateSelectorDialog' } })
)

import { useWorkflowTemplateSelectorDialog } from './useWorkflowTemplateSelectorDialog'

let dialogStore: ReturnType<typeof useDialogStore>

beforeEach(() => {
  mockNewUserService.isNewUser.mockReturnValue(false)
  dialogStore = useDialogStore()
})

/** The props the composable handed the content component. */
function contentProps() {
  const dialog = dialogStore.dialogStack.find((d) => d.key === DIALOG_KEY)
  expect(dialog, 'the template library is on the dialog stack').toBeDefined()
  return dialog!.contentProps as {
    onClose: () => void
    onTemplateSelected: (selected: boolean) => void
  }
}

function closedCalls(): TemplateLibraryClosedMetadata[] {
  return vi
    .mocked(useTelemetry()!.trackTemplateLibraryClosed)
    .mock.calls.map(([metadata]) => metadata)
}

function openFillerDialog(key: string) {
  dialogStore.showDialog({ key, component: h('div') })
}

describe('template library close paths', () => {
  it('path 1 — a template pick closes in_dialog and is attributed as selected', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    contentProps().onTemplateSelected(true)
    // loadWorkflowTemplate closes the dialog itself once the graph load starts,
    // with no key and no method hint of its own. It must not read as a
    // dismissal. See WorkflowTemplateSelectorDialog.test.ts for the same path
    // driven end to end through a real click.
    dialogStore.closeDialog()

    expect(closedCalls()).toEqual([
      expect.objectContaining({
        close_method: 'in_dialog',
        template_selected: true
      })
    ])
  })

  it('path 1 — a pick that never starts a load leaves a later dismissal honest', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    contentProps().onTemplateSelected(true)
    contentProps().onTemplateSelected(false)
    dialogStore.closeDialog({ key: DIALOG_KEY })

    expect(closedCalls()).toEqual([
      expect.objectContaining({
        close_method: 'dismissed',
        template_selected: false
      })
    ])
  })

  it('path 2 — the in-dialog close button closes in_dialog with no selection', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    // What BaseModalLayout's close button invokes through OnCloseKey.
    contentProps().onClose()

    expect(closedCalls()).toEqual([
      expect.objectContaining({
        close_method: 'in_dialog',
        template_selected: false
      })
    ])
  })

  it('paths 3–5 — Escape, overlay press and focus-outside all emit dismissed', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    // GlobalDialog's @update:open handler, verbatim. Reka raises
    // escapeKeyDown, pointerDownOutside and focusOutside into this one call.
    dialogStore.closeDialog({ key: DIALOG_KEY })

    expect(closedCalls()).toEqual([
      expect.objectContaining({
        close_method: 'dismissed',
        template_selected: false
      })
    ])
  })

  it('paths 3–5 stay reachable — the dialog is configured to dismiss', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    const dialog = dialogStore.dialogStack.find((d) => d.key === DIALOG_KEY)
    const props = dialog!.dialogComponentProps

    expect(props.closable, 'closable gates closeOnEscape').toBe(true)
    expect(props.closeOnEscape, 'Escape dismisses').toBe(true)
    expect(props.dismissableMask, 'an overlay press dismisses').not.toBe(false)
    expect(
      props.dismissOnFocusOutside,
      'focus leaving the content dismisses'
    ).not.toBe(false)
  })

  it('path 6 — a programmatic hide is not counted as a user close', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    // useSharedWorkflowUrlLoader closes the library when a shared workflow URL
    // resolves. Nobody dismissed anything.
    useWorkflowTemplateSelectorDialog().hide()

    expect(closedCalls()).toEqual([
      expect.objectContaining({ close_method: 'programmatic' })
    ])
  })

  it('path 6 — hide() from a second composable instance is still programmatic', () => {
    // show() and hide() are called from different call sites, each with its own
    // composable instance. Per-instance state would misattribute this as a
    // dismissal.
    useWorkflowTemplateSelectorDialog().show('sidebar')
    useWorkflowTemplateSelectorDialog().hide()

    expect(closedCalls()).toEqual([
      expect.objectContaining({ close_method: 'programmatic' })
    ])
  })

  it('path 7 — the 10-dialog stack cap emits evicted', () => {
    for (let i = 0; i < 9; i++) openFillerDialog(`filler-${i}`)
    useWorkflowTemplateSelectorDialog().show('sidebar')
    expect(dialogStore.dialogStack).toHaveLength(10)
    expect(dialogStore.dialogStack[0].key).toBe(DIALOG_KEY)

    openFillerDialog('filler-evictor')

    expect(dialogStore.isDialogOpen(DIALOG_KEY)).toBe(false)
    expect(closedCalls()).toEqual([
      expect.objectContaining({ close_method: 'evicted' })
    ])
  })

  it('emits exactly one event per open, whichever path runs first', () => {
    useWorkflowTemplateSelectorDialog().show('sidebar')

    // The in-dialog path routes through hide() -> closeDialog, so onClose and
    // onRemoved both fire for this one dismissal.
    contentProps().onClose()
    expect(closedCalls()).toHaveLength(1)

    // Anything arriving afterwards belongs to no open session.
    dialogStore.closeDialog({ key: DIALOG_KEY })
    useWorkflowTemplateSelectorDialog().hide()

    expect(closedCalls()).toHaveLength(1)
  })

  it('emits once per reopen rather than once per lifetime', () => {
    const dialog = useWorkflowTemplateSelectorDialog()

    dialog.show('sidebar')
    dialogStore.closeDialog({ key: DIALOG_KEY })
    dialog.show('menu')
    dialogStore.closeDialog({ key: DIALOG_KEY })

    expect(closedCalls().map((c) => c.close_method)).toEqual([
      'dismissed',
      'dismissed'
    ])
  })

  it('measures time_spent_seconds from the opened event, not from mount', () => {
    vi.useFakeTimers()
    try {
      useWorkflowTemplateSelectorDialog().show('sidebar')
      vi.advanceTimersByTime(4_500)
      dialogStore.closeDialog({ key: DIALOG_KEY })
    } finally {
      vi.useRealTimers()
    }

    expect(closedCalls()).toEqual([
      expect.objectContaining({ time_spent_seconds: 4 })
    ])
  })
})
