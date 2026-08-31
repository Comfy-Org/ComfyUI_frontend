function hasOpenRekaDialog(): boolean {
  return Array.from(
    document.querySelectorAll('[role="dialog"][data-state="open"]')
  ).some(
    (dialog) => dialog.closest('[data-reka-popper-content-wrapper]') === null
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
    document.querySelector(
      '[role="dialog"][aria-modal="true"]:not([hidden])'
    ) !== null ||
    hasOpenRekaDialog() ||
    hasOpenNativeDialog() ||
    hasVisibleLegacyModal()
  )
}
