export async function openExportWorkflowApiDialog() {
  const { useExportWorkflowApiDialog } =
    await import('@/platform/workflow/export/composables/useExportWorkflowApiDialog')
  useExportWorkflowApiDialog().show()
}
