function hasOpenRekaDialog(): boolean {
  return Array.from(
    document.querySelectorAll('[role="dialog"][data-state="open"]')
  ).some(
    (dialog) => dialog.closest('[data-reka-popper-content-wrapper]') === null
  )
}

export function isModalOpen(managedDialogCount: number): boolean {
  return (
    managedDialogCount > 0 ||
    document.querySelector('[role="dialog"][aria-modal="true"]') !== null ||
    hasOpenRekaDialog()
  )
}
