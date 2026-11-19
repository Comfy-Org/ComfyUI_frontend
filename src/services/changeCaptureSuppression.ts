let changeCaptureSuppressionDepth = 0

export function beginChangeCaptureSuppression(): () => void {
  changeCaptureSuppressionDepth++
  let active = true
  return () => {
    if (!active) return
    active = false
    changeCaptureSuppressionDepth--
  }
}

export function isChangeCaptureSuppressed(): boolean {
  return changeCaptureSuppressionDepth > 0
}
