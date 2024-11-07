export function isElectron() {
  return 'electronAPI' in window && window['electronAPI'] !== undefined
}
