// Whitelist management functions

export function isWhitelisted(): boolean {
  return localStorage.getItem('whitelisted') === 'true'
}

export function setWhitelisted(value: boolean): void {
  localStorage.setItem('whitelisted', value ? 'true' : 'false')
}

export function addToWhitelist(): void {
  setWhitelisted(true)
}

export function removeFromWhitelist(): void {
  setWhitelisted(false)
}
