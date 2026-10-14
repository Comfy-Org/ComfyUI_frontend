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

it.for([
  "navigator.clipboard.writeText('text')",
  "window.navigator.clipboard.writeText('text')",
  "navigator['clipboard'].writeText('text')",
  "api.getServerFeature('flag')",
  "const getServerFeature = api.getServerFeature.bind(api); getServerFeature('flag')",
  'canvas.ds.scale = 2',
  'canvas.ds.offset[0] += 1',
  'canvas.ds.scale++',
  '--canvas.ds.offset[0]',
  'new Date(0).toLocaleDateString()',
  'new Date(0).toLocaleTimeString()',
  "import { t } from '@/i18n'; t('g.copy')"
])('rejects direct platform access: %s', async (code) => {
  const results = await eslint.lintText(
    `<script setup lang="ts">${code}</script>`,
    { filePath: 'src/workbench/extensions/agent/AgentPanelRoot.vue' }
  )

  expect(
    results.flatMap(({ messages }) =>
      messages
        .filter(({ ruleId }) => ruleId === 'no-restricted-syntax')
        .map(({ severity }) => severity)
    )
  ).toEqual([2])
})

it('allows shared utilities and viewport reads', async () => {
  const results = await eslint.lintText(
    `<script setup lang="ts">
const { copy } = useClipboard()
copy('text')
const flags = useFeatureFlags()
const scale = canvas.ds.scale
const offset = canvas.ds.offset[0]
canvas.setZoom(scale + 1, [0, 0])
let count = 0
count++
formatDate(timestamp)
const { t } = useI18n()
t('g.copy')
</script>`,
    { filePath: 'src/workbench/extensions/agent/AgentPanelRoot.vue' }
  )

  expect(
    results.flatMap(({ messages }) =>
      messages.filter(({ ruleId }) => ruleId === 'no-restricted-syntax')
    )
  ).toEqual([])
})
