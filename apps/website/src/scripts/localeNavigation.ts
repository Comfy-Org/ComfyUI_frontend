document.addEventListener('astro:before-preparation', (event) => {
  const loadDocument = event.loader
  event.loader = async () => {
    await loadDocument()
    if (event.defaultPrevented || event.signal.aborted) return
    try {
      const { loadPageLocale } = await import('@/i18n/translations')
      await loadPageLocale(event.newDocument, event.signal)
    } catch {
      event.preventDefault()
    }
  }
})
