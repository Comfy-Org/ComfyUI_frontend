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
  'new Date(0).toLocaleString()',
  '(1234).toLocaleString()',
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
state.scale = 2
state.offset[0]++
let count = 0
count++
formatDate(timestamp)
const upper = label.toLocaleUpperCase()
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

const restrictionMessages = (
  results: ESLint.LintResult[],
  ruleIds: readonly string[]
) =>
  results.flatMap(({ messages }) =>
    messages
      .filter(({ ruleId }) => ruleId !== null && ruleIds.includes(ruleId))
      .map(({ message }) => message)
  )

const DEADLINE_RULES = ['no-restricted-globals', 'no-restricted-properties']
const DEADLINE_FILES = [
  'src/workbench/extensions/agent/composables/agent/useAttachment.ts',
  'src/workbench/extensions/agent/services/agent/agentEventSource.ts'
]
const UNTARGETED_AGENT_FILE =
  'src/workbench/extensions/agent/services/agent/agentRestClient.ts'

it.for(
  DEADLINE_FILES.flatMap((filePath) =>
    [
      'setTimeout(() => {}, 1)',
      'clearTimeout(handle)',
      'window.setTimeout(() => {}, 1)',
      'globalThis.clearTimeout(handle)'
    ].map((code) => ({ filePath, code }))
  )
)('rejects raw timers in $filePath: $code', async ({ filePath, code }) => {
  const results = await eslint.lintText(code, { filePath })

  expect(restrictionMessages(results, DEADLINE_RULES)).toHaveLength(1)
})

it.for([
  ...DEADLINE_FILES.map((filePath) => ({
    filePath,
    code: 'useTimeoutFn(() => {}, 1)'
  })),
  { filePath: UNTARGETED_AGENT_FILE, code: 'setTimeout(() => {}, 1)' }
])('allows $code in $filePath', async ({ filePath, code }) => {
  const results = await eslint.lintText(code, { filePath })

  expect(restrictionMessages(results, DEADLINE_RULES)).toEqual([])
})

const FILENAME_MESSAGE =
  'Use the platform filename utilities (getFilenameDetails, getPathDetails).'
const FILENAME_FILES = [
  'src/workbench/extensions/agent/utils/attachableFiles.ts',
  'src/workbench/extensions/agent/utils/resolveReplyAssetDownload.ts'
]

it.for(
  FILENAME_FILES.flatMap((filePath) =>
    [
      "name.split('.').pop()",
      "path.split('/').pop()",
      "path.split('\\\\').pop()",
      "name.lastIndexOf('.')",
      "path.lastIndexOf('/')"
    ].map((code) => ({ filePath, code }))
  )
)(
  'rejects local filename parsing in $filePath: $code',
  async ({ filePath, code }) => {
    const results = await eslint.lintText(code, { filePath })

    expect(restrictionMessages(results, ['no-restricted-syntax'])).toEqual([
      FILENAME_MESSAGE
    ])
  }
)

it.for(FILENAME_FILES)(
  'keeps the channel restrictions in %s',
  async (filePath) => {
    const results = await eslint.lintText(
      "navigator.clipboard.writeText('text')",
      { filePath }
    )

    expect(restrictionMessages(results, ['no-restricted-syntax'])).toEqual([
      'Use the shared clipboard composables.'
    ])
  }
)

it.for([
  ...FILENAME_FILES.flatMap((filePath) =>
    [
      "expected.split('')",
      "csv.split(',')",
      "text.lastIndexOf('x')",
      'getFilenameDetails(name).suffix'
    ].map((code) => ({ filePath, code }))
  ),
  { filePath: UNTARGETED_AGENT_FILE, code: "name.split('.').pop()" }
])('allows $code in $filePath', async ({ filePath, code }) => {
  const results = await eslint.lintText(code, { filePath })

  expect(restrictionMessages(results, ['no-restricted-syntax'])).toEqual([])
})
