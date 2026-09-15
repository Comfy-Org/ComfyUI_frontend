---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# Engineering Guidelines

General engineering principles for the frontend codebase. File-type-specific
conventions live in the sibling guidance docs (`typescript.md`,
`vue-components.md`, `vitest.md`, `playwright.md`); the root `AGENTS.md` holds
build/test commands, style, and guardrails.

## Development Guidelines

The root `AGENTS.md` carries the always-loaded subset (VueUse, es-toolkit,
i18n, PrimeVue, tests, self-documenting code, simplicity, immutability, pure
functions). The rest:

1. If a complex type definition is inlined in multiple related places, extract and name it for reuse
2. Implement proper error handling
3. Do not add or retain redundant comments, clean as you go
4. [Refactoring](https://refactoring.com/catalog/) should be used to make complex code simpler
5. Try to minimize the surface area (exported values) of each module and composable
6. Don't use barrel files, e.g. `/some/package/index.ts` to re-export within `/src`
7. Keep functions short and functional
8. Minimize [nesting](https://wiki.c2.com/?ArrowAntiPattern), e.g. `if () { ... }` or `for () { ... }`
9. Do not use function expressions if it's possible to use function declarations instead
10. Watch out for [Code Smells](https://wiki.c2.com/?CodeSmell) and refactor to avoid them
11. Do not add alias helpers whose implementation is just a single-line call to another function
    - Bad: `function id(value) { return nodeId(value) }`
    - Use the real function directly, or introduce a named helper only when it adds validation, branching, domain meaning, or shared behavior beyond renaming

## Project Philosophy

- Follow good software engineering principles
  - YAGNI
  - AHA
  - DRY
  - SOLID
- Clean, stable public APIs
- Domain-driven design
- Thousands of users and extensions
- Prioritize clean interfaces that restrict extension access

## Code Review

In doing a code review, you should make sure that:

- The code is well-designed.
- The functionality is good for the users of the code.
- Any UI changes are sensible and look good.
- Any parallel programming is done safely.
- The code isn’t more complex than it needs to be.
- The developer isn’t implementing things they might need in the future but don’t know they need now.
- Code has appropriate unit tests.
- Tests are well-designed.
- The developer used clear names for everything.
- Comments are clear and useful, and mostly explain why instead of what.
- Code is appropriately documented (generally in g3doc).
- The code conforms to our style guides.

### [Complexity](https://google.github.io/eng-practices/review/reviewer/looking-for.html#complexity)

Is the CL more complex than it should be? Check this at every level of the CL—are individual lines too complex? Are functions too complex? Are classes too complex? “Too complex” usually means “can’t be understood quickly by code readers.” It can also mean “developers are likely to introduce bugs when they try to call or modify this code.”

A particular type of complexity is over-engineering, where developers have made the code more generic than it needs to be, or added functionality that isn’t presently needed by the system. Reviewers should be especially vigilant about over-engineering. Encourage developers to solve the problem they know needs to be solved now, not the problem that the developer speculates might need to be solved in the future. The future problem should be solved once it arrives and you can see its actual shape and requirements in the physical universe.

## Repository Navigation

- Check README files in key folders (browser_tests, composables, etc.)
- Prefer running single tests for performance
- Use --help for unfamiliar CLI tools

## GitHub Integration

When referencing Comfy-Org repos:

1. Check for local copy
2. Use GitHub API for branches/PRs/metadata
3. Curl GitHub website if needed

## External Resources

- Vue: <https://vuejs.org/api/>
- Tailwind: <https://tailwindcss.com/docs/styling-with-utility-classes>
- VueUse: <https://vueuse.org/functions.html>
- shadcn/vue: <https://www.shadcn-vue.com/>
- Reka UI: <https://reka-ui.com/>
- PrimeVue: <https://primevue.org>
- Comfy Design Standards: <https://www.figma.com/design/QreIv5htUaSICNuO2VBHw0/Comfy-Design-Standards>
- ComfyUI: <https://docs.comfy.org>
- Electron: <https://www.electronjs.org/docs/latest/>
- Wiki: <https://deepwiki.com/Comfy-Org/ComfyUI_frontend/1-overview>
- [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
