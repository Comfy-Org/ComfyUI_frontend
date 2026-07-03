# Source Code Guidelines

## TypeScript

- Never use `any` or `as any` (enforced by oxlint) — fix the underlying type issue
- Avoid `@ts-expect-error` — fix the underlying issue instead
- When handling uncertain types, prefer in order:
  1. Properly typed from the start
  2. Type narrowing — `if ('prop' in obj)` or type guards
  3. Specific assertion (`as SpecificType`) when you truly know the type
  4. `unknown` with narrowing for genuinely unknown data
- Zod: never `z.any()` — it disables validation and propagates `any` into
  types. Use `z.unknown()` and narrow. Never add test-only settings/types to
  production schemas
- Extract type guards and their interfaces into leaf modules (files with only
  `import type` statements) so they are safe to import from anywhere without
  pulling in heavy transitive dependencies or creating cycles
- Keep public API types stable (e.g. `ExtensionManager`); don't expose
  internal implementation types (e.g. Pinia store internals); unwrap reactive
  refs (`ComputedRef<T>`) before exposing
- Use `es-toolkit` for utility functions
- API calls: use the api helpers — `api.get(api.apiURL('/prompt'))`,
  `fetch(api.fileURL('/templates/default.json'))` — never construct
  `/api/...` URLs by hand

## Error Handling

- User-friendly and actionable messages
- Proper error propagation

## Security

- Sanitize HTML with DOMPurify
- Validate trusted sources
- Never log secrets

## State Management (Stores)

- Follow domain-driven design for organizing files/folders
- Clear public interfaces
- Restrict extension access
- Clean up subscriptions
- Only expose state/actions that are used externally; keep internal state private

## i18n

- Use `vue-i18n` for ALL user-facing strings (`src/locales/en/main.json`)

## Unit Tests (`*.test.ts`)

- Use `@testing-library/vue` with `@testing-library/user-event` (an ESLint
  rule bans `@vue/test-utils` imports in new tests)
- No change-detector tests (asserting defaults), no tests of non-behavioral
  features (styles, classes), no tests that only exercise mocks — ensure real
  code is exercised. Be parsimonious; avoid redundant tests
- Mocking: use `vi.mock`/`vi.spyOn`; keep module mocks contained (no global
  mutable state — use `vi.hoisted()` for per-test arrangement); don't mock
  what you don't own
- Typed fixtures: build partial mocks with `fromPartial<T>()` from
  `@total-typescript/shoehorn` — never `as unknown as X` double assertions,
  never `fromAny` (it erases the type checking that `fromPartial` preserves)
- Before writing a mock builder, search for existing factories:
  `src/utils/__tests__/litegraphTestUtils.ts` (`createMockLGraphNode`,
  `createMockLGraph`, `createMockCanvas`, ...) and colocated `__tests__/`
  helpers next to the type you are mocking
- Mock only at seams — Pinia stores, settings, third-party libraries. Never
  mock type guards, litegraph classes, or sibling composables of the unit
  under test
- Use a real `createI18n` instance (see
  `src/components/searchbox/v2/__test__/testUtils.ts`) instead of
  `vi.mock('vue-i18n')`
- Assertions: no bare `expect(fn).not.toThrow()` as a test's only assertion;
  don't assert values a stub was configured to return; don't assert on
  `.mock.results` — assert observable behavior instead
- Wait for reactivity with `await nextTick()` after state changes
- Read `docs/testing/<topic>.md` (unit-testing, component-testing,
  store-testing, vitest-patterns) when writing the corresponding kind of test

```bash
pnpm test:unit                       # Run all unit tests
pnpm test:unit path/to/file          # Filter by substring of test file path
pnpm test:unit foo.test.ts -t "name" # Filter by test name (it()/test() only)
```

Do not use a `--` separator before vitest args; pnpm forwards extra args
automatically, and `--` mangles quoted args (e.g. `-t "two words"`) on Windows
PowerShell.

## Vue Components (`*.vue`)

The root `AGENTS.md` covers Composition API conventions. Additionally:

- Prefer `emit`/`@event-name` for state changes; use `defineExpose` only for
  imperative operations (`form.validate()`, `modal.open()`)
- Prefer VueUse composables over manual event handling: `useElementHover`,
  `useIntersectionObserver`, `useFocusTrap`, `useEventListener`
  (auto-cleanup). Prefer Vue-native `defineModel` over `useVModel`
- Inline Tailwind only — no `<style>` blocks. Exception: third-party libraries
  that render runtime DOM outside Vue templates (e.g. xterm internals) may use
  scoped `:deep()` selectors with a brief comment explaining why
- Design tokens and Tailwind configuration:
  `packages/design-system/src/css/style.css`
- In unmount hooks, clean up async operations

## Design Standards

When adding new UI or changing visual design, fetch the relevant section of
the Comfy Design Standards Figma file first — file keys and section node IDs
are in `docs/guidance/design-standards.md`. Skip this for refactors, bugfixes,
and logic-only changes. If the Figma MCP is unavailable, say so in the PR
description instead of skipping silently.

## Storybook (`*.stories.ts`)

Place stories alongside their components. Use realistic ComfyUI schemas for
mock data (node definitions, components).

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import ComponentName from './ComponentName.vue'

const meta: Meta<typeof ComponentName> = {
  title: 'Category/ComponentName',
  component: ComponentName,
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}
```

Variants: always include `Default`; add `Loading` and `Error` if the component
fetches data, `Empty` if it renders a collection, `WithData` for realistic
content.

Run with `pnpm storybook` (dev server) or `pnpm build-storybook`.
