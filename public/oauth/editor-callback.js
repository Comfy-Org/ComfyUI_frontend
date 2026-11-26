// This page loads no analytics or application code while the OAuth response is in the URL.
;(() => {
  const response = location.href
  history.replaceState(null, '', location.pathname)
  const key = 'Comfy.EditorProvider'
  try {
    const attempt = JSON.parse(sessionStorage.getItem(key))
    const destination = new URL(attempt.destination, location.origin)
    if (
      destination.origin !== location.origin ||
      !['/cloud/login', '/cloud/signup'].includes(destination.pathname)
    )
      throw new Error()
    sessionStorage.setItem(key + '.callback', response)
    location.replace(destination.href)
  } catch {
    sessionStorage.removeItem(key)
    sessionStorage.removeItem(key + '.callback')
    location.replace('/cloud/login')
  }
})()
