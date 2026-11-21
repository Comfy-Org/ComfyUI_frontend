const ROOT_HAS =
  /(?:^|[\s>+~,(])(?::root|html|body)(?![\w-])(?:[^\s>+~,()]|\([^()]*\))*:has\(\s*(?![>+~\s])/

export function isSlowHasSelector(selector: string): boolean {
  return ROOT_HAS.test(selector)
}

function describeSheet(sheet: CSSStyleSheet): string {
  if (sheet.href) return sheet.href.replace(/[?#].*$/, '')
  const owner = sheet.ownerNode
  if (owner && 'id' in owner && owner.id) return `<style id="${owner.id}">`
  return 'an inline <style>'
}

function collectSlowHasSelectors(
  rules: CSSRuleList,
  found: string[],
  imported: CSSStyleSheet[]
) {
  for (const rule of rules) {
    if ('styleSheet' in rule && rule.styleSheet)
      imported.push(rule.styleSheet as CSSStyleSheet)
    if (
      'selectorText' in rule &&
      typeof rule.selectorText === 'string' &&
      isSlowHasSelector(rule.selectorText)
    )
      found.push(rule.selectorText)
    if ('cssRules' in rule)
      collectSlowHasSelectors(rule.cssRules as CSSRuleList, found, imported)
  }
}

function warnAboutSheet(sheet: CSSStyleSheet) {
  const found: string[] = []
  const imported: CSSStyleSheet[] = []
  try {
    collectSlowHasSelectors(sheet.cssRules, found, imported)
  } catch {
    return
  }
  for (const selector of found)
    console.warn(
      `[ComfyUI] Slow selector in ${describeSheet(sheet)}: ${selector}\n` +
        ':has() on :root, html or body can make the browser restyle the whole document on every DOM insertion. Put :has() on the closest container, or match direct children with :has(> ...).'
    )
  imported.forEach(warnAboutSheet)
}

export function warnAboutSlowHasSelectors(
  sheets: Iterable<CSSStyleSheet> = document.styleSheets
) {
  for (const sheet of sheets) warnAboutSheet(sheet)
}
