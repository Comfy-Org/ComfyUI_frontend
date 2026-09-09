// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import lintStaged from '../../lint-staged.config'

const eslint = new ESLint()
const filePath = 'apps/website/src/pages/lint-coverage.astro'

describe('website Astro linting', () => {
  it('checks canonical classes and Astro directives', async () => {
    const results = await eslint.lintText(
      '<div class="tracking-[0.05em]" set:text="label">content</div>',
      { filePath }
    )

    const ruleIds = results.flatMap((result) =>
      result.messages.map((message) => message.ruleId)
    )
    expect(ruleIds).toContain('better-tailwindcss/enforce-canonical-classes')
    expect(ruleIds).toContain('astro/no-conflict-set-directives')
  })

  it('checks embedded scripts while recognizing template references', async () => {
    const results = await eslint.lintText(
      `---
const title: string = 'Hello'
---
<h1>{title}</h1>
<script>
const value: number = 1
console.log(value)
debugger
</script>`,
      { filePath }
    )

    expect(results.flatMap((result) => result.messages)).toEqual([
      expect.objectContaining({ ruleId: 'no-debugger' })
    ])
  })

  it('runs ESLint and the website typecheck for an Astro-only commit', () => {
    const commands = lintStaged([`${process.cwd()}/${filePath}`])

    expect(commands).toContain(
      `pnpm exec eslint --cache --fix --no-warn-ignored "${filePath}"`
    )
    expect(commands).toContain('pnpm typecheck:website')
  })
})
