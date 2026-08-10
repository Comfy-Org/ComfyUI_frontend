import { describe, expect, it } from 'vitest'

import { convert } from '../conversion/convert'
import { CONFORMANCE_CHECKS, runConformance } from './conformance'
import type { ConformanceContext } from './conformance'
import type { RunOutcome } from './runner'

const outcome = (over: Partial<RunOutcome> = {}): RunOutcome => ({
  loaded: true,
  loadError: undefined,
  registeredTypes: ['A'],
  constructed: new Map([['A', true]]),
  wire: { workflow: '{}', prompt: '' },
  deprecations: 0,
  ...over
})

function context(over: Partial<ConformanceContext> = {}): ConformanceContext {
  const original =
    'const a = 1;\nthis.type = this.type ?? undefined;\nconst b = 2;'
  const result = convert(original)
  return {
    pack: 'p',
    file: 'f.js',
    original,
    converted: result.source,
    edits: result.edits,
    ...over
  }
}

const find = (report: ReturnType<typeof runConformance>, id: string) =>
  report.results.find((r) => r.id === id)!

describe('general conversion conformance', () => {
  it('every check reports the id it was asked for', () => {
    const report = runConformance(context())
    expect(report.results.map((r) => r.id).sort()).toEqual(
      CONFORMANCE_CHECKS.map((c) => c.id).sort()
    )
  })

  it('passes a real mechanical conversion', () => {
    const report = runConformance(context())
    expect(report.passed).toBe(true)
    expect(find(report, 'edits-apply-cleanly').status).toBe('passed')
  })

  describe('edits must reproduce the artifact', () => {
    it('fails when the converted source does not match the edits', () => {
      const report = runConformance(
        context({ converted: 'something else entirely' })
      )
      expect(find(report, 'edits-apply-cleanly').status).toBe('failed')
      expect(report.passed).toBe(false)
    })

    it('fails when an edit targets a line the source does not have', () => {
      const report = runConformance(
        context({ edits: [{ line: 999, op: 'delete' }] })
      )
      expect(find(report, 'edits-apply-cleanly').detail).toMatch(
        /does not match/
      )
    })
  })

  describe('syntax', () => {
    it('skips ES modules, which the runtime load check covers', () => {
      // `new Function` rejects import/export outright, so applying it to a
      // module would report a syntax error for every real pack.
      const report = runConformance(
        context({
          original: "import { app } from './app.js'\nconst a = 1;",
          converted: "import { app } from './app.js'\nconst a = 1;",
          edits: []
        })
      )
      const check = find(report, 'converted-source-parses')
      expect(check.status).toBe('skipped')
      expect(check.detail).toMatch(/runtime load check/)
    })

    it('rejects a conversion that produced invalid JavaScript', () => {
      const report = runConformance(
        context({ converted: 'function ( {', edits: [] })
      )
      expect(find(report, 'converted-source-parses').status).toBe('failed')
    })
  })

  describe('capability escalation', () => {
    it('fails a conversion that introduces eval', () => {
      const report = runConformance(
        context({ original: 'const a = 1;', converted: 'eval("x")', edits: [] })
      )
      expect(find(report, 'no-new-capabilities').status).toBe('failed')
      expect(find(report, 'no-new-capabilities').detail).toMatch(/eval/)
    })

    it('allows a capability the original already used', () => {
      // Scoped to the diff: a pack that already used eval is not our problem.
      const report = runConformance(
        context({ original: 'eval("a")', converted: 'eval("b")', edits: [] })
      )
      expect(find(report, 'no-new-capabilities').status).toBe('passed')
    })
  })

  describe('shim detection', () => {
    it('fails a conversion that grows the file substantially', () => {
      const original = Array.from({ length: 10 }, () => 'x()').join('\n')
      const converted = Array.from({ length: 60 }, () => 'x()').join('\n')
      const report = runConformance(context({ original, converted, edits: [] }))
      expect(find(report, 'no-net-new-lines').status).toBe('failed')
      expect(find(report, 'no-net-new-lines').detail).toMatch(/shim/)
    })

    it('tolerates a call site becoming a line or two longer', () => {
      const original = Array.from({ length: 200 }, () => 'x()').join('\n')
      const report = runConformance(
        context({ original, converted: original + '\ny()', edits: [] })
      )
      expect(find(report, 'no-net-new-lines').status).toBe('passed')
    })
  })

  describe('the old surface must actually be retired', () => {
    it('fails a conversion that still patches a prototype', () => {
      // Crystools' first accepted conversion rewrote the function body but left
      // `nodeType.prototype.onExecuted = ...` in place, so nothing became
      // deletable — every other check passed it.
      const report = runConformance(
        context({
          original: 'nodeType.prototype.onExecuted = function () {}',
          converted: 'nodeType.prototype.onExecuted = function () {}',
          edits: []
        })
      )
      const check = find(report, 'retires-the-old-surface')
      expect(check.status).toBe('failed')
      expect(check.detail).toMatch(/onExecuted/)
    })

    it('passes once the registration itself is converted', () => {
      const report = runConformance(
        context({
          original: 'nodeType.prototype.onExecuted = function () {}',
          converted: 'comfy.defs.extend("A", (b) => b.onExecuted(() => {}))',
          edits: []
        })
      )
      expect(find(report, 'retires-the-old-surface').status).toBe('passed')
    })
  })

  describe('the legacy global', () => {
    it('fails a file that converted its hooks but kept window.comfyAPI', () => {
      // kjnodes' ideogram4_prompt_builder.js: every hook converted, and one
      // `const { app } = window.comfyAPI.app` left holding the old surface
      // open. retires-the-old-surface only looks at prototype patching, so it
      // passed. The whole point is that the surface becomes deletable.
      const report = runConformance(
        context({
          original: 'const { app } = window.comfyAPI.app; app.foo()',
          converted:
            "import { comfy } from '/comfy/api/v1.js';\n" +
            'const { app } = window.comfyAPI.app;\n' +
            'comfy.defs.extend("A", (b) => b.onCreated(() => app.foo()))',
          edits: []
        })
      )
      const check = find(report, 'retires-the-legacy-global')
      expect(check.status).toBe('failed')
      expect(check.detail).toMatch(/window\.comfyAPI/)
    })

    it('passes a file that is fully off it', () => {
      const report = runConformance(
        context({
          original: 'const { app } = window.comfyAPI.app;',
          converted: 'comfy.defs.extend("A", (b) => b.onCreated(() => {}))',
          edits: []
        })
      )
      expect(find(report, 'retires-the-legacy-global').status).toBe('passed')
    })

    it('does not fail on the name appearing only in a comment', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: '// Replaces window.comfyAPI.app\nnode.setTitle("x")',
          edits: []
        })
      )
      expect(find(report, 'retires-the-legacy-global').status).toBe('passed')
    })
  })

  describe('sanctioned hold-outs', () => {
    it('still fails, but says the hold-out was a decision', () => {
      const report = runConformance(
        context({
          original: 'const { app } = window.comfyAPI.app; app.loadGraphData(x)',
          converted:
            '// SANCTIONED-HOLDOUT(workflow-save-load): no published loader.\n' +
            'const { app } = window.comfyAPI.app;\n' +
            'app.loadGraphData(x)',
          edits: []
        })
      )
      const check = find(report, 'retires-the-legacy-global')
      expect(check.status).toBe('failed')
      expect(check.detail).toMatch(/Sanctioned hold-out \(workflow-save-load\)/)
    })

    it('reads the marker even though it is a comment', () => {
      // The check strips comments before scanning for API usage, so the
      // marker has to be read off the raw source or it is never seen.
      const report = runConformance(
        context({
          original: 'window.comfyAPI.app',
          converted:
            '/* SANCTIONED-HOLDOUT(document-api): nothing opens a workflow */\n' +
            'const { app } = window.comfyAPI.app;',
          edits: []
        })
      )
      expect(find(report, 'retires-the-legacy-global').detail).toMatch(
        /document-api/
      )
    })

    it('an unmarked hold-out reads as unconverted, not sanctioned', () => {
      const report = runConformance(
        context({
          original: 'window.comfyAPI.app',
          converted: 'const { app } = window.comfyAPI.app;',
          edits: []
        })
      )
      const check = find(report, 'retires-the-legacy-global')
      expect(check.detail).not.toMatch(/Sanctioned/)
      expect(check.detail).toMatch(/becomes deletable/)
    })
  })

  describe('what counts as patching or mutating', () => {
    it('ignores a third-party library configuring its own prototype', () => {
      // alekpet's painter does `fabric.Object.prototype.cornerColor = …` to
      // set up fabric.js. That is not a node class being patched.
      const report = runConformance(
        context({
          original: 'nodeType.prototype.onExecuted = function () {}',
          converted:
            'fabric.Object.prototype.cornerColor = "#108ce6"\n' +
            'comfy.defs.extend("A", (b) => b.onExecuted(() => {}))',
          edits: []
        })
      )
      expect(find(report, 'retires-the-old-surface').status).toBe('passed')
    })

    it('still catches a real prototype patch', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: 'nodeType.prototype.onExecuted = function () {}',
          edits: []
        })
      )
      expect(find(report, 'retires-the-old-surface').status).toBe('failed')
    })

    it('does not treat an optional-chained DOM call as a dropped write', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: 'element?.addEventListener("input", fn)',
          edits: []
        })
      )
      expect(find(report, 'no-silently-dropped-writes').status).toBe('passed')
    })

    it('does not flag a bare remove/add, which DOM elements also have', () => {
      // `remove`, `add` and `set` are published members too, so requiring the
      // CamelCase form is what separates `widgets.remove(name)` -- called on a
      // handle you already hold -- from `element?.remove()`.
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: 'container?.remove()\nsomeSet?.add(x)',
          edits: []
        })
      )
      expect(find(report, 'no-silently-dropped-writes').status).toBe('passed')
    })

    it('still catches an optional-chained handle write', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: 'node.widgets.get("seed")?.setValue(1)',
          edits: []
        })
      )
      expect(find(report, 'no-silently-dropped-writes').status).toBe('failed')
    })
  })

  describe('the comment stripper', () => {
    it('is not desynchronised by a regex literal containing a quote', () => {
      // `/(['"])/` has a quote inside it. Treating that as the start of a
      // string desynchronised the scanner for the rest of the file, after
      // which no comment was stripped at all -- so two conversions were failed
      // for members appearing only in the API-GAP comments they were asked to
      // write.
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted:
            'const re = /^(\\d+)=([\'"])([^\'"]*)$/\n' +
            '// API-GAP: node.chrome has no destination\n' +
            'node.setTitle("x")',
          edits: []
        })
      )
      const check = find(report, 'no-unknown-api-members')
      expect(check.status).toBe('passed')
      expect(check.detail).not.toMatch(/chrome/)
    })

    it('still treats a division as division', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted:
            'const half = total / 2\n// API-GAP: node.chrome\nnode.setTitle("x")',
          edits: []
        })
      )
      expect(find(report, 'no-unknown-api-members').status).toBe('passed')
    })
  })

  describe('the indentation report', () => {
    it('does not fail a file whose body was dedented wholesale', () => {
      // Unwrapping registerExtension takes two levels off everything inside
      // it, and the conversion guidance requires that re-indent. The check
      // used to fail exactly that, contradicting the guidance -- three correct
      // kjnodes conversions failed on ~93% indentation-only lines.
      const body = Array.from({ length: 40 }, (_, i) => `    doThing(${i})`)
      const original = [
        'app.registerExtension({',
        '  setup() {',
        ...body.map((l) => '  ' + l),
        '  }',
        '})'
      ].join('\n')
      const converted = body.map((l) => l.trimStart()).join('\n')

      const report = runConformance(context({ original, converted, edits: [] }))

      expect(find(report, 'diff-is-mostly-substance').status).toBe('passed')
    })

    it('never gates, whatever the ratio', () => {
      const report = runConformance(
        context({
          original: 'a()\nb()\nc()',
          converted: '        a()\n        b()\n        c()',
          edits: []
        })
      )
      expect(find(report, 'diff-is-mostly-substance').status).not.toBe('failed')
    })

    it('still counts genuinely new lines as substance', () => {
      const report = runConformance(
        context({ original: 'a()', converted: 'a()\nbrandNew()', edits: [] })
      )
      expect(find(report, 'diff-is-mostly-substance').detail).toMatch(
        /1 substantive line/
      )
    })
  })

  describe('invented API members', () => {
    it('fails a conversion that calls something the API does not define', () => {
      const report = runConformance(
        context({
          original: 'node.computeSize()',
          // Was setSizeConstraints until that shipped; the point is a member
          // the API does not define, not this particular name.
          converted: 'node.setMagicLayout({ autoHeight: true })',
          edits: []
        })
      )
      const check = find(report, 'no-unknown-api-members')
      expect(check.status).toBe('failed')
      expect(check.detail).toMatch(/setMagicLayout/)
    })

    it('accepts real API members', () => {
      const report = runConformance(
        context({
          original: 'this.widgets.length = 1',
          converted: 'node.widgets.remove(name)',
          edits: []
        })
      )
      expect(find(report, 'no-unknown-api-members').status).toBe('passed')
    })

    it('does not flag an API named only inside a comment', () => {
      // Conversions are asked to name what they could not reach. Scanning the
      // comment failed the files that documented themselves and passed the
      // ones that stayed quiet — five of seven kjnodes failures were this.
      const report = runConformance(
        context({
          original: 'node.chrome.addBadge("?")',
          converted:
            '// API-GAP: node.chrome has no destination; used a menu entry.\n' +
            'b.addMenuItem({ label: "Help", run: () => {} })',
          edits: []
        })
      )
      expect(find(report, 'no-unknown-api-members').status).toBe('passed')
    })

    it('still flags an unknown member outside a comment', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted:
            '// API-GAP: node.chrome is unavailable.\nnode.setMagicLayout()',
          edits: []
        })
      )
      const check = find(report, 'no-unknown-api-members')
      expect(check.status).toBe('failed')
      expect(check.detail).toMatch(/setMagicLayout/)
      expect(check.detail).not.toMatch(/chrome/)
    })

    it('keeps a URL in a string, which is not a comment', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: 'const u = "https://example.com/x"; node.setTitle(u)',
          edits: []
        })
      )
      expect(find(report, 'no-unknown-api-members').status).toBe('passed')
    })

    it('does not flag JavaScript built-ins', () => {
      const report = runConformance(
        context({
          original: 'const a = 1',
          converted: 'names.slice(1).map((n) => n.trim()).indexOf("x")',
          edits: []
        })
      )
      expect(find(report, 'no-unknown-api-members').status).toBe('passed')
    })

    it('does not flag a member the original already used', () => {
      // Scoped to the diff: the pack's own helpers are not our business.
      const report = runConformance(
        context({
          original: 'thing.packSpecificHelper()',
          converted: 'thing.packSpecificHelper(); node.widgets.names()',
          edits: []
        })
      )
      expect(find(report, 'no-unknown-api-members').status).toBe('passed')
    })
  })

  describe('checks that need execution are skipped, not silently passed', () => {
    it('skips runtime checks when the artifact was not run', () => {
      const report = runConformance(context())
      const ids = report.skipped.map((r) => r.id)
      expect(ids).toContain('loads')
      expect(ids).toContain('registers-no-fewer-types')
      expect(ids).toContain('retires-deprecations')
    })

    it('does not let skips make the report fail', () => {
      expect(runConformance(context()).passed).toBe(true)
    })

    it('skips the deprecation check when the baseline was zero', () => {
      const report = runConformance(
        context({
          run: {
            before: outcome({ deprecations: 0 }),
            after: outcome({ deprecations: 0 })
          }
        })
      )
      const check = find(report, 'retires-deprecations')
      expect(check.status).toBe('skipped')
      expect(check.detail).toMatch(/proves nothing/)
    })
  })

  describe('runtime invariants', () => {
    it('fails when the conversion loses a node type', () => {
      const report = runConformance(
        context({
          run: {
            before: outcome({ registeredTypes: ['A', 'B'] }),
            after: outcome({ registeredTypes: ['A'] })
          }
        })
      )
      const check = find(report, 'registers-no-fewer-types')
      expect(check.status).toBe('failed')
      expect(check.detail).toMatch(/B/)
    })

    it('fails when the conversion stops the pack loading', () => {
      const report = runConformance(
        context({
          run: {
            before: outcome(),
            after: outcome({ loaded: false, loadError: 'bad patch' })
          }
        })
      )
      expect(find(report, 'loads').detail).toBe('bad patch')
    })

    it('treats a pack that never loaded as a harness limit, not a failure', () => {
      const report = runConformance(
        context({
          run: {
            before: outcome({ loaded: false }),
            after: outcome({ loaded: false })
          }
        })
      )
      const check = find(report, 'loads')
      expect(check.status).toBe('skipped')
      expect(check.detail).toMatch(/harness limitation/)
    })

    it('passes when deprecations drop against a real baseline', () => {
      const report = runConformance(
        context({
          run: {
            before: outcome({ deprecations: 12 }),
            after: outcome({ deprecations: 0 })
          }
        })
      )
      expect(find(report, 'retires-deprecations').detail).toBe('12 → 0.')
    })

    it('fails when deprecations do not drop', () => {
      const report = runConformance(
        context({
          run: {
            before: outcome({ deprecations: 4 }),
            after: outcome({ deprecations: 4 })
          }
        })
      )
      expect(find(report, 'retires-deprecations').status).toBe('failed')
    })
  })
})

describe('handle state must go through accessors', () => {
  it('fails a property write on a handle', () => {
    // kjnodes appearance.js was converted this way: node.color = '#1b4669'
    // compiles, does nothing, and took every type in the pack down with it.
    const report = runConformance(
      context({
        original: 'node.color = c',
        converted: "node.color = '#1b4669'",
        edits: []
      })
    )
    const check = find(report, 'handles-use-accessors')
    expect(check.status).toBe('failed')
    expect(check.detail).toMatch(/node\.color/)
  })

  it('passes the accessor form', () => {
    const report = runConformance(
      context({
        original: 'node.color = c',
        converted: "node.setColor('#1b4669')",
        edits: []
      })
    )
    expect(find(report, 'handles-use-accessors').status).toBe('passed')
  })

  it('leaves a pack’s own objects alone', () => {
    const report = runConformance(
      context({
        original: 'x = 1',
        converted:
          'const state = stateFor(id); state.value = 2; state.hidden = true',
        edits: []
      })
    )
    expect(find(report, 'handles-use-accessors').status).toBe('passed')
  })
})
