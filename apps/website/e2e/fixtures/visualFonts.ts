import type { Page } from '@playwright/test'

const visualFontFamily = 'PP Formula Light Visual'

const visualFontCss = `
  @font-face {
    font-family: '${visualFontFamily}';
    src: url('/fonts/PPFormula-Light.woff2') format('woff2');
    font-weight: 300;
    font-style: normal;
    font-display: block;
  }

  .font-formula.font-light {
    font-family: '${visualFontFamily}', sans-serif;
  }
`

export async function stabilizePpFormulaLight(page: Page) {
  await page.addStyleTag({ content: visualFontCss })
  const loadedFaces = await page.evaluate(
    (family) =>
      document.fonts.load(`300 1em "${family}"`).then((faces) => faces.length),
    visualFontFamily
  )

  if (loadedFaces === 0) throw new Error('PP Formula Light failed to load')
}
