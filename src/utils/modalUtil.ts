function isRendered(element: Element): boolean {
  return (
    element.closest('[hidden], [aria-hidden="true"]') === null &&
    element.checkVisibility({ visibilityProperty: true })
  )
}

function hasOpenRekaDialog(): boolean {
  return Array.from(
    document.querySelectorAll('[role="dialog"][data-state="open"]')
  ).some(
    (dialog) =>
      dialog.closest('[data-reka-popper-content-wrapper]') === null &&
      isRendered(dialog)
  )
}

function hasOpenNativeDialog(): boolean {
  return Array.from(document.querySelectorAll('dialog[open]')).some(isRendered)
}

function hasVisibleAriaModal(): boolean {
  return Array.from(
    document.querySelectorAll('[role="dialog"][aria-modal="true"]')
  ).some(isRendered)
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
