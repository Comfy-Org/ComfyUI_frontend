type Translate = (key: string) => string

export function createFailedToSaveDraftToast(t: Translate) {
  return {
    severity: 'error' as const,
    summary: t('g.error'),
    detail: t('toastMessages.failedToSaveDraft')
  }
}
