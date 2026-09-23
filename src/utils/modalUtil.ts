const NON_MODAL_OVERLAY_SELECTOR =
  '.p-popover, [data-reka-popper-content-wrapper]'

function isRendered(element: Element): boolean {
  return (
    element.closest('[hidden], [aria-hidden="true"]') === null &&
    element.checkVisibility({ visibilityProperty: true })
  )
}

function isBlockingModal(element: Element): boolean {
  return (
    element.closest(NON_MODAL_OVERLAY_SELECTOR) === null && isRendered(element)
  )
}

function hasOpenRekaDialog(): boolean {
  return Array.from(
    document.querySelectorAll('[role="dialog"][data-state="open"]')
  ).some(isBlockingModal)
}

function hasOpenNativeDialog(): boolean {
  return Array.from(document.querySelectorAll('dialog[open]')).some(isRendered)
}

function hasVisibleAriaModal(): boolean {
  return Array.from(
    document.querySelectorAll('[role="dialog"][aria-modal="true"]')
  ).some(isBlockingModal)
}

function hasVisibleLegacyModal(): boolean {
  return Array.from(document.querySelectorAll('.comfy-modal')).some(isRendered)
}

export function isModalOpen(managedDialogCount: number): boolean {
  return (
    managedDialogCount > 0 ||
    hasVisibleAriaModal() ||
    hasOpenRekaDialog() ||
    hasOpenNativeDialog() ||
    hasVisibleLegacyModal()
  )
}
