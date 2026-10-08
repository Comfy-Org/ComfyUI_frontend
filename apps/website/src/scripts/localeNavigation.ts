document.addEventListener('astro:before-preparation', (event) => {
  const loadDocument = event.loader
  event.loader = async () => {
    await loadDocument()
    if (event.defaultPrevented) return
    try {
      const { loadPageLocale } = await import('@/i18n/translations')
      await loadPageLocale(event.newDocument)
    } catch {
      event.preventDefault()
    }
  }
})
