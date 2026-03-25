export function prefetchShareDialog() {
  importShareDialog().catch((error) => {
    console.error(error)
  })
}

export async function openShareDialog() {
  const { useShareDialog } = await importShareDialog()
  useShareDialog().show()
}

function importShareDialog() {
  return import('@/platform/workflow/sharing/composables/useShareDialog')
}
