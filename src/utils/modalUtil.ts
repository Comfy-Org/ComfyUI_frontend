function isElementHidden(style: CSSStyleDeclaration): boolean {
  return (
    style.display === 'none' ||
    style.display === 'contents' ||
    style.visibility === 'hidden' ||
    style.visibility === 'collapse' ||
    style.contentVisibility === 'hidden'
  )
}

function ancestorHidesDescendants(style: CSSStyleDeclaration): boolean {
  return style.display === 'none' || style.contentVisibility === 'hidden'
}

function isRendered(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]') !== null) return false

  if (typeof element.checkVisibility !== 'function') {
    if (isElementHidden(getComputedStyle(element))) return false

    for (
      let current = element.parentElement;
      current;
      current = current.parentElement
    ) {
      if (ancestorHidesDescendants(getComputedStyle(current))) return false
    }

    return true
  }

  return element.checkVisibility({ visibilityProperty: true })
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
