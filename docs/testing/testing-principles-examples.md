# Testing Principles: Worked Examples

Companion to [`docs/guidance/testing-principles.md`](../guidance/testing-principles.md).
That file is auto-loaded into agent context for every `*.test.ts` and
`*.spec.ts` edit, so it stays terse. This file is for people. It shows what
each contested rule looks like in practice, with examples drawn from this
repository where one exists.

## Verify state and output; verify a call only when the call is the contract

The rule prefers asserting on what the code returns, renders, or persists.
Asserting on how it got there (which collaborator it called, in what order)
ties the test to one implementation.

A query verification that adds nothing, because the result already proves it:

```ts
// Change detector: the returned list already proves the store was read.
expect(store.getNodes).toHaveBeenCalled()
expect(result).toEqual([nodeA, nodeB])
```

A request verification that is the contract, because nothing else observes it.
`fetchVideoMetadata` promises to reuse one download across cache-busting
query strings; the only way to see that promise kept is the call count
([videoMetadataUtil.test.ts](../../src/utils/videoMetadataUtil.test.ts)):

```ts
const first = await fetchVideoMetadata(`${url}&rand=0.1`)
const second = await fetchVideoMetadata(`${url}&rand=0.2`)

expect(second).toEqual(first)
expect(fetchMock).toHaveBeenCalledTimes(1)
```

Likewise, a store that owns the request to `/api/agent/run-mode` may assert the
path and body it sent, because the request shape is the boundary it owns and
the server is a double (Fowler calls this a narrow integration test). What it
must not do is assert that an internal helper was called on the way.

## Compatibility tests: proactive for public contracts, reactive for internal behavior

The reactive rule ("add one only after an observed breakage") comes from
[`e2e-coverage-strategy.md`](./e2e-coverage-strategy.md), where it governs
E2E pins under `legacyDoNotReplicate`. Those pins protect behavior nobody
designed, so evidence of breakage is the only justification for one.

Documented public contracts are different. Serialization formats, extension
callbacks such as `onConnectionsChange`, and `node.serialize()` reach 40+
custom node repositories. A break ships to the ecosystem before any internal
evidence appears, so one narrow test per contract is written up front.
[`LGraph.linkPresentation.test.ts`](../../src/lib/litegraph/src/LGraph.linkPresentation.test.ts)
pins link presentation serialization this way;
[`storeCollisionContracts.test.ts`](../../src/stores/storeCollisionContracts.test.ts)
pins store ID collision behavior.

Either way the shape is the same: one test, one contract, one literal expected
value. A compatibility suite that re-tests every field of every format is a
change detector with a better name.

## N + M + 1 is a hypothesis about the design

Beck's arithmetic (one table per dimension plus one composition test) holds
"provided the dimensions are separated in the design." If widget type and node
state are handled by separate code paths that compose, the composition test
proves the wiring and the tables prove each path:

```ts
describe.for(widgetCases)('$widget widget', ({ widget, expected }) => { … })
describe.for(nodeStateCases)('$state node', ({ state, expected }) => { … })
it('renders a widget inside a bypassed node with both effects', () => { … })
```

If a particular pair does interact (a renderer that special-cases one widget in
one node state), that pair is a fault the tables cannot see. Add it as a named
row in a sparse interaction table and say why it exists:

```ts
it.for([
  { name: 'combo in bypassed node keeps options, regression #12345', … },
  { name: 'image widget in collapsed node hides preview, documented', … }
])('$name', …)
```

This repository uses `it.for` and `describe.for`, not `it.each`. `for` passes
each row as one argument whatever its shape, so object rows and `$field`
names behave the same everywhere, and it exposes the test context as the
second argument.

Do not respond by crossing the full product. Pairwise coverage catches most
interaction faults (NIST); an explicit list catches the rest.

## No loops or conditionals in a test body

Control flow in a test is code that can itself be wrong, and it has no test.
A loop that never iterates passes. A branch that is never taken passes. The
rule is absolute; every case people raise has a remedy that is also a better
test. Around 400 `for … of` lines exist in this repository's tests today. They
are the reason the rule is written down, and they get fixed when touched.

**A loop over inputs is a table.** Which surface failed?

```ts
it('hides on all surfaces', () => {
  for (const surface of ['canvas', 'panel', 'inspector']) {
    expect(isVisible(hiddenWidget, surface)).toBe(false)
  }
})
```

```ts
it.for(['canvas', 'panel', 'inspector'])('hides on %s', (surface) => {
  expect(isVisible(hiddenWidget, surface)).toBe(false)
})
```

**A loop over outputs is one assertion on the collection.** A graph-wide
invariant ("every link has a presentation") is a property of the whole set, so
assert it on the whole set. The failure message then shows the offending
element and its index instead of stopping at the first miss
(compare [LGraph.linkPresentationTransfer.test.ts](../../src/lib/litegraph/src/LGraph.linkPresentationTransfer.test.ts)):

```ts
for (const link of rootGraph.links.values()) {
  expect(store.getPresentation(scope, link.id)).toEqual(expected)
}
```

```ts
const links = [...rootGraph.links.values()]
expect(links.map((link) => store.getPresentation(scope, link.id))).toEqual(
  links.map(() => expected)
)
```

When the same invariant recurs across files, give it a name with
`expect.extend` (`toPresentEveryLink`) so the test reads as one sentence.
Meszaros calls this a Custom Assertion. The loop moves into the matcher, where
it is tested by the matcher's own tests, not hidden in each spec.

**A conditional that narrows a type is an assertion.** `if (!node) throw` in
a test is a branch the test never exercises. Vitest's `assert` (chai) narrows
for you, so the check is a straight-line assertion that fails with a message:

```ts
import { assert, expect, it } from 'vitest'

const node = graph.getNodeById(id)
assert.exists(node)
expect(node.title).toBe('KSampler')
```

`assert.exists` is typed `asserts value is NonNullable<T>`; `assert.isDefined`
and `assert.isNotNull` narrow one side each. When several tests need the same
narrowed object, a typed builder that constructs it is better still, because
then there is nothing to narrow.

**Cleanup is `afterEach`.** A loop that disposes resources at the end of a
test runs only if every assertion before it passed. `afterEach` runs
regardless, and it is where readers look for it.

**Property-based tests are tables with a generator.** `fc.assert(fc.property(
arbitrary, (input) => …))` has no loop in the test body; fast-check owns the
iteration and reports the shrunk counterexample. The body inside the property
follows the same rule: one input, straight-line assertions.

**A branch that selects the expectation is two tests:**

```ts
if (mode === 'cloud') expect(result).toBe(cloudValue)
else expect(result).toBe(localValue)
```

```ts
it.for([
  { mode: 'cloud', expected: cloudValue },
  { mode: 'local', expected: localValue }
])('returns $expected in $mode mode', ({ mode, expected }) => { … })
```

## Expected values are literal

A test that computes its expectation with the logic under test cannot fail:

```ts
expect(formatDuration(ms)).toBe(formatDuration(ms))
expect(total).toBe(items.reduce((sum, item) => sum + item.price, 0))
```

Write the number. If it is hard to derive by hand, that is a sign the input is
too large for a unit test, not a reason to compute it.
