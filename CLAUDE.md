- use `npm run` to see what commands are available
- For component communication, prefer Vue's event-based pattern (emit/@event-name) for state changes and notifications; use defineExpose with refs only for imperative operations that need direct control (like form.validate(), modal.open(), or editor.focus()); events promote loose coupling and are better for reusable components, while exposed methods are acceptable for tightly-coupled component pairs or when wrapping third-party libraries that require imperative APIs
- After making code changes, follow this general process: (1) Create unit tests, component tests, browser tests (if appropriate for each), (2) run unit tests, component tests, and browser tests until passing, (3) run typecheck, lint, format (with prettier) -- you can use `npm run` command to see the scripts available, (4) check if any READMEs (including nested) or documentation needs to be updated, (5) Decide whether the changes are worth adding new content to the external documentation for (or would requires changes to the external documentation) at https://docs.comfy.org, then present your suggestion
- When referencing PrimeVue, you can get all the docs here: https://primevue.org. Do this instead of making up or inferring names of Components
- When trying to set tailwind classes for dark theme, use "dark-theme:" prefix rather than "dark:"
- Never add lines to PR descriptions or commit messages that say "Generated with Claude Code"
- When making PR names and commit messages, if you are going to add a prefix like "docs:", "feat:", "bugfix:", use square brackets around the prefix term and do not use a colon (e.g., should be "[docs]" rather than "docs:").
- When I reference GitHub Repos related to Comfy-Org, you should proactively fetch or read the associated information in the repo. To do so, you should exhaust all options: (1) Check if we have a local copy of the repo, (2) Use the GitHub API to fetch the information; you may want to do this IN ADDITION to the other options, especially for reading specific branches/PRs/comments/reviews/metadata, and (3) curl the GitHub website and parse the html or json responses
- For information about ComfyUI, ComfyUI_frontend, or ComfyUI-Manager, you can web search or download these wikis: https://deepwiki.com/Comfy-Org/ComfyUI-Manager, https://deepwiki.com/Comfy-Org/ComfyUI_frontend/1-overview, https://deepwiki.com/comfyanonymous/ComfyUI/2-core-architecture
- If a question/project is related to Comfy-Org, Comfy, or ComfyUI ecosystem, you should proactively use the Comfy docs to answer the question. The docs may be referenced with URLs like https://docs.comfy.org
- When operating inside a repo, check for README files at key locations in the repo detailing info about the contents of that folder. E.g., top-level key folders like tests-ui, browser_tests, composables, extensions/core, stores, services often have their own README.md files. When writing code, make sure to frequently reference these README files to understand the overall architecture and design of the project. Pay close attention to the snippets to learn particular patterns that seem to be there for a reason, as you should emulate those.
- Prefer running single tests, and not the whole test suite, for performance
- If using a lesser known or complex CLI tool, run the --help to see the documentation before deciding what to run, even if just for double-checking or verifying things.
- IMPORTANT: the most important goal when writing code is to create clean, best-practices, sustainable, and scalable public APIs and interfaces. Our app is used by thousands of users and we have thousands of mods/extensions that are constantly changing and updating; and we are also always updating. That's why it is IMPORTANT that we design systems and write code that follows practices of domain-driven design, object-oriented design, and design patterns (such that you can assure stability while allowing for all components around you to change and evolve). We ABSOLUTELY prioritize clean APIs and public interfaces that clearly define and restrict how/what the mods/extensions can access.
- If any of these technologies are referenced, you can proactively read their docs at these locations: https://primevue.org/theming, https://primevue.org/forms/, https://www.electronjs.org/docs/latest/api/browser-window, https://vitest.dev/guide/browser/, https://atlassian.design/components/pragmatic-drag-and-drop/core-package/drop-targets/, https://playwright.dev/docs/api/class-test, https://playwright.dev/docs/api/class-electron, https://www.algolia.com/doc/api-reference/rest-api/, https://pyav.org/docs/develop/cookbook/basics.html
- IMPORTANT: Never add Co-Authored by Claude or any reference to Claude or Claude Code in commit messages, PR descriptions, titles, or any documentation whatsoever
- The npm script to type check is called "typecheck" NOT "type check"
- Use the Vue 3 Composition API instead of the Options API when writing Vue components. An exception is when overriding or extending a PrimeVue component for compatibility, you may use the Options API.
- when we are solving an issue we know the link/number for, we should add "Fixes #n" (where n is the issue number) to the PR description.
- Never write css if you can accomplish the same thing with tailwind utility classes
- Utilize ref and reactive for reactive state
- Implement computed properties with computed()
- Use watch and watchEffect for side effects
- Implement lifecycle hooks with onMounted, onUpdated, etc.
- Utilize provide/inject for dependency injection
- Use vue 3.5 style of default prop declaration. Do not define a `props` variable; instead, destructure props. Since vue 3.5, destructuring props does not strip them of reactivity.
- Use Tailwind CSS for styling
- Leverage VueUse functions for performance-enhancing styles
- Use lodash for utility functions
- Implement proper props and emits definitions
- Utilize Vue 3's Teleport component when needed
- Use Suspense for async components
- Implement proper error handling
- Follow Vue 3 style guide and naming conventions
- Use vue-i18n in composition API for any string literals. Place new translation entries in src/locales/en/main.json.
- Avoid using `@ts-expect-error` to work around type issues. We needed to employ it to migrate to TypeScript, but it should not be viewed as an accepted practice or standard.
- DO NOT use deprecated PrimeVue components. Use these replacements instead:
  * `Dropdown` → Use `Select` (import from 'primevue/select')
  * `OverlayPanel` → Use `Popover` (import from 'primevue/popover') 
  * `Calendar` → Use `DatePicker` (import from 'primevue/datepicker')
  * `InputSwitch` → Use `ToggleSwitch` (import from 'primevue/toggleswitch')
  * `Sidebar` → Use `Drawer` (import from 'primevue/drawer')
  * `Chips` → Use `AutoComplete` with multiple enabled and typeahead disabled
  * `TabMenu` → Use `Tabs` without panels
  * `Steps` → Use `Stepper` without panels
  * `InlineMessage` → Use `Message` component
* Use `api.apiURL()` for all backend API calls and routes
  - Actual API endpoints like /prompt, /queue, /view, etc.
  - Image previews: `api.apiURL('/view?...')`
  - Any backend-generated content or dynamic routes
* Use `api.fileURL()` for static files served from the public folder:
  - Templates: `api.fileURL('/templates/default.json')`
  - Extensions: `api.fileURL(extensionPath)` for loading JS modules
  - Any static assets that exist in the public directory
