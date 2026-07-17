---
globs:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.vue'
---

# Engineering Guidelines

General engineering principles for `src/`. File-type-specific conventions live in
the sibling guidance docs (`typescript.md`, `vue-components.md`, `vitest.md`,
`playwright.md`); the root `AGENTS.md` holds build/test commands, style, and
guardrails.

## Development Guidelines

1. Leverage VueUse functions for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use TypeScript for type safety
4. If a complex type definition is inlined in multiple related places, extract and name it for reuse
5. In Vue Components, implement proper props and emits definitions
6. Utilize Vue 3's Teleport component when needed
7. Use Suspense for async components
8. Implement proper error handling
9. Follow Vue 3 style guide and naming conventions
10. Use Vite for fast development and building
11. Use vue-i18n in composition API for any string literals. Place new translation entries in src/locales/en/main.json. Use the plurals system in i18n instead of hardcoding pluralization in templates.
12. Avoid new usage of PrimeVue components
13. Write tests for all changes, especially bug fixes to catch future regressions
14. Write code that is expressive and self-documenting to the furthest degree possible. This reduces the need for code comments which can get out of sync with the code itself. Try to avoid comments unless absolutely necessary
15. Do not add or retain redundant comments, clean as you go
16. Whenever a new piece of code is written, the author should ask themselves 'is there a simpler way to introduce the same functionality?'. If the answer is yes, the simpler course should be chosen
17. [Refactoring](https://refactoring.com/catalog/) should be used to make complex code simpler
18. Try to minimize the surface area (exported values) of each module and composable
19. Don't use barrel files, e.g. `/some/package/index.ts` to re-export within `/src`
20. Keep functions short and functional
21. Minimize [nesting](https://wiki.c2.com/?ArrowAntiPattern), e.g. `if () { ... }` or `for () { ... }`
22. Avoid mutable state, prefer immutability and assignment at point of declaration
23. Favor pure functions (especially testable ones)
24. Do not use function expressions if it's possible to use function declarations instead
25. Watch out for [Code Smells](https://wiki.c2.com/?CodeSmell) and refactor to avoid them

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
