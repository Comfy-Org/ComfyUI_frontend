import { handsPopupsToSystemBrowser } from '@/platform/distribution/desktopBrowser'

export interface OpeningPage {
  readonly lang: string
  readonly title: string
  readonly detail: string
}

const OPENING_PAGE_STYLE = `
html, body { height: 100%; margin: 0; }
body { display: flex; align-items: center; justify-content: center; background: #171717; color: #fff; font-family: Inter, system-ui, sans-serif; }
main { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
h1 { margin: 8px 0 0; font-size: 16px; font-weight: 600; }
p { margin: 0; font-size: 12px; color: #8a8a8a; }
[role="progressbar"] { width: 20px; height: 20px; border: 2px solid #fff; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`

function paintOpeningPage(page: Document, opening: OpeningPage): void {
  page.documentElement.lang = opening.lang
  page.title = opening.title
  const style = page.createElement('style')
  style.textContent = OPENING_PAGE_STYLE
  const spinner = page.createElement('div')
  spinner.setAttribute('role', 'progressbar')
  spinner.setAttribute('aria-label', opening.title)
  const heading = page.createElement('h1')
  heading.textContent = opening.title
  const detail = page.createElement('p')
  detail.textContent = opening.detail
  const main = page.createElement('main')
  main.append(spinner, heading, detail)
  page.head.append(style)
  page.body.replaceChildren(main)
}

export interface BillingTab {
  navigate(url: string): void
  close(): void
}

/** Opens a billing page in a new tab; `false` only when the browser blocked it. */
export function openBillingUrl(url: string): boolean {
  const tab = window.open(url, '_blank')
  return tab !== null || handsPopupsToSystemBrowser()
}

/**
 * Reserves a billing tab during the click, before its URL is known; `null`
 * when the browser blocked it. On Desktop the open waits for the URL.
 * `opening` is shown in the reserved tab until it navigates.
 */
export function reserveBillingTab(opening?: OpeningPage): BillingTab | null {
  if (handsPopupsToSystemBrowser()) {
    return {
      navigate: (url) => {
        window.open(url, '_blank')
      },
      close: () => {}
    }
  }
  const tab = window.open('', '_blank')
  if (!tab) return null
  tab.opener = null
  if (opening) paintOpeningPage(tab.document, opening)
  return {
    navigate: (url) => {
      tab.location.href = url
    },
    close: () => tab.close()
  }
}
