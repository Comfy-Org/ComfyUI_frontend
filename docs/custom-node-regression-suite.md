# Custom-Node Regression Suite - Technical Design Doc

The source of truth for this document lives in Notion (commentable,
edited by the team):

**https://app.notion.com/p/3ac6d73d365081d19be4da63fad17589**

CI failure messages cite this path with step names (e.g. "Step 5c") -
find those steps in the Notion page's "Onboarding a pack" section.
Step headings and quoted assertion messages there are pinned by CI
failure strings and pure specs: renaming them requires a frontend PR,
not just a Notion edit.

Spec files: `browser_tests/tests/customNodes/`. Fixtures:
`browser_tests/fixtures/customNode/`. Quick start:
`pnpm test:custom-nodes:local`.
