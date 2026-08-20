const ARIA_MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]'
const REKA_OPEN_DIALOG_SELECTOR = '[role="dialog"][data-state="open"]'

/**
 * Popovers and dropdowns also render as role="dialog", but they neither trap
 * focus nor block the page, so they must not suppress global shortcuts.
 *
 * PrimeVue is matched on `data-pc-name` rather than only its theme class,
 * because most Popover call sites pass `unstyled`, which drops `.p-popover`
 * while keeping the attribute.
 */
const NON_MODAL_OVERLAY_SELECTOR =
  '.p-popover, [data-pc-name="popover"], [data-reka-popper-content-wrapper]'

/**
 * Overlays are commonly hidden by toggling `display` on an ancestor (a mask or
 * wrapper) while the dialog node itself keeps its own display value, and some
 * extensions leave that node in the DOM permanently once created.
 */
function isDisplayNone(element: Element): boolean {
  for (
    let node: Element | null = element;
    node !== null;
    node = node.parentElement
  ) {
    if (getComputedStyle(node).display === 'none') {
      return true
    }
  }
  return false
}

function isBlockingModal(element: Element): boolean {
  return (
    element.closest(NON_MODAL_OVERLAY_SELECTOR) === null &&
    !isDisplayNone(element)
  )
}

function hasOpenAriaModal(): boolean {
  return Array.from(document.querySelectorAll(ARIA_MODAL_SELECTOR)).some(
    isBlockingModal
  )
}

function hasOpenRekaDialog(): boolean {
  return Array.from(document.querySelectorAll(REKA_OPEN_DIALOG_SELECTOR)).some(
    isBlockingModal
  )
}

function hasOpenNativeDialog(): boolean {
  return document.querySelector('dialog[open]') !== null
}

/** ComfyDialog toggles visibility via inline display ('flex' / 'none'). */
function hasVisibleLegacyModal(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.comfy-modal')
  ).some(
    (modal) => modal.style.display !== '' && modal.style.display !== 'none'
  )
}

export function isModalOpen(managedDialogCount: number): boolean {
  return (
    managedDialogCount > 0 ||
    hasOpenAriaModal() ||
    hasOpenRekaDialog() ||
    hasOpenNativeDialog() ||
    hasVisibleLegacyModal()
  )
}
