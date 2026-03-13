export async function openPublishDialog() {
  const { usePublishDialog } = await importPublishDialog()
  usePublishDialog().show()
}

export async function openAuthorDashboardDialog() {
  const { useAuthorDashboardDialog } = await importAuthorDashboardDialog()
  useAuthorDashboardDialog().show()
}

function importPublishDialog() {
  return import('@/platform/marketplace/composables/usePublishDialog')
}

function importAuthorDashboardDialog() {
  return import('@/platform/marketplace/composables/useAuthorDashboardDialog')
}
