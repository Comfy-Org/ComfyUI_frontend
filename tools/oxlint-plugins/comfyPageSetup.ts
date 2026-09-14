import type { Rule } from 'eslint'

// `comfyPageFixture` already calls `comfyPage.setup()` once per test before
// the test body runs (browser_tests/fixtures/ComfyPage.ts). A test that calls
// it again re-navigates and re-clears storage on top of that automatic setup,
// which is the "naughty" pattern AustinMroz identified as a source of
// video-recording timeouts in
// https://github.com/Comfy-Org/ComfyUI_frontend/pull/16711#pullrequestreview-5096346494.
// Use `test.use({ initialSettings/initialFeatureFlags })` or a dedicated
// fixture option to vary startup instead of re-running `setup()`.

interface Identifier {
  readonly type: 'Identifier'
  readonly name: string
}

interface MemberExpression {
  readonly type: 'MemberExpression'
  readonly object: Node
  readonly property: Node
  readonly computed: boolean
}

interface CallExpression {
  readonly type: 'CallExpression'
  readonly callee: Node
}

type Node = Identifier | MemberExpression | CallExpression | { type: string }

interface RuleContext {
  report(descriptor: { node: unknown; message: string }): void
}

function propertyName(member: MemberExpression): string | undefined {
  if (member.computed) return undefined
  return member.property.type === 'Identifier'
    ? (member.property as Identifier).name
    : undefined
}

export const noComfyPageSetupCall = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') return
        const member = callee as MemberExpression
        if (propertyName(member) !== 'setup') return
        if (
          member.object.type !== 'Identifier' ||
          (member.object as Identifier).name !== 'comfyPage'
        ) {
          return
        }

        context.report({
          node,
          message:
            'comfyPage.setup() already runs once per test via comfyPageFixture; calling it again re-navigates and re-clears storage, which has caused test timeouts. Configure startup with test.use({ initialSettings, initialFeatureFlags }) instead.'
        })
      }
    }
  }
}

export const preferInitialSettings: Rule.RuleModule = {
  create(context) {
    return {
      'CallExpression[callee.property.name="beforeEach"] CallExpression[callee.object.object.name="comfyPage"][callee.object.property.name="settings"][callee.property.name="setSetting"]'(
        node: Rule.Node
      ) {
        context.report({
          node,
          message:
            'Prefer test.use({ initialSettings }) for startup settings. Keep this setter only if it depends on runtime state or setup ordering; preserve inherited overrides and pre-navigation mocks when moving it.'
        })
      },
      'CallExpression[callee.property.name="afterEach"] CallExpression[callee.object.object.name="comfyPage"][callee.object.property.name="settings"][callee.property.name="setSetting"]'(
        node: Rule.Node
      ) {
        context.report({
          node,
          message:
            'comfyPageFixture replaces settings before each test. Remove settings-only teardown; keep cleanup of uploaded files and saved workflows.'
        })
      }
    }
  }
}
