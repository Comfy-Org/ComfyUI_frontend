const ROOT_HAS =
  /(?:^|[\s>+~,(])(?::root|html|body)(?![\w-])[^\s>+~,()]*:has\(\s*(?![>+~\s])/

export function isSlowHasSelector(selector: string): boolean {
  return ROOT_HAS.test(selector)
}

function describeSheet(sheet: CSSStyleSheet): string {
  if (sheet.href) return sheet.href
  const owner = sheet.ownerNode
  if (owner && 'id' in owner && owner.id) return `<style id="${owner.id}">`
  return 'an inline <style>'
}

function collectSlowHasSelectors(rules: CSSRuleList, found: string[]) {
  for (const rule of rules) {
    if (
      'selectorText' in rule &&
      typeof rule.selectorText === 'string' &&
      isSlowHasSelector(rule.selectorText)
    )
      found.push(rule.selectorText)
    if ('cssRules' in rule)
      collectSlowHasSelectors(rule.cssRules as CSSRuleList, found)
  }
}

export function warnAboutSlowHasSelectors(
  sheets: Iterable<CSSStyleSheet> = document.styleSheets
) {
  for (const sheet of sheets) {
    const found: string[] = []
    try {
      collectSlowHasSelectors(sheet.cssRules, found)
    } catch {
      continue
    }
    for (const selector of found)
      console.warn(
        `[ComfyUI] Slow selector in ${describeSheet(sheet)}: ${selector}\n` +
          ':has() on :root, html or body makes the browser re-check the whole document on every DOM insertion. Put :has() on the closest container, or match direct children with :has(> ...).'
      )
  }
}
