import { ESLint } from 'eslint'
import { expect, it } from 'vitest'

const eslint = new ESLint()
await eslint.calculateConfigForFile(
  'src/workbench/extensions/agent/AgentPanelRoot.vue'
)

it.for([
  {
    filePath: 'src/workbench/extensions/agent/AgentPanelRoot.vue',
    expectedCount: 2
  },
  {
    filePath: 'src/workbench/extensions/agent/crdt/CrdtDevPanel.vue',
    expectedCount: 0
  },
  { filePath: 'src/components/LintFixture.vue', expectedCount: 0 }
])('checks console calls in $filePath', async ({ filePath, expectedCount }) => {
  const results = await eslint.lintText(
    `<script setup lang="ts">
console.warn('warning')
console.error('error')
</script>`,
    { filePath }
  )

  expect(
    results.flatMap(({ messages }) =>
      messages.filter(({ ruleId }) => ruleId === 'no-console')
    )
  ).toHaveLength(expectedCount)
})
