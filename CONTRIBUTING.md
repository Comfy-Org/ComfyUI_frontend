# Contributing to ComfyUI Frontend

We're building this frontend together and would love your help — no matter how you'd like to pitch in! You don't need to write code to make a difference.

## Ways to Contribute

- **Pull Requests:** Add features, fix bugs, or improve code health. Browse [issues](https://github.com/Comfy-Org/ComfyUI_frontend/issues) for inspiration. Look for the `Good first issue` label if you're new to the project.
- **Vote on Features:** Give a 👍 to the feature requests you care about to help us prioritize.
- **Verify Bugs:** Try reproducing reported issues and share your results (even if the bug doesn't occur!).
- **Community Support:** Hop into our [Discord](https://discord.com/invite/comfyorg) to answer questions or get help.
- **Share & Advocate:** Tell your friends, tweet about us, or share tips to support the project.

Have another idea? Drop into Discord or open an issue, and let's chat!

## Development Setup

### Prerequisites & Technology Stack

- **Required Software**:
  - Node.js (v16 or later; v20/v22 strongly recommended) and npm
  - Git for version control
  - A running ComfyUI backend instance
  
- **Tech Stack**:
  - [Vue 3.5 Composition API](https://vuejs.org/) with [TypeScript](https://www.typescriptlang.org/)
  - [Pinia](https://pinia.vuejs.org/) for state management
  - [PrimeVue](https://primevue.org/) with [TailwindCSS](https://tailwindcss.com/) for UI
  - litegraph.js (integrated in src/lib) for node editor
  - [zod](https://zod.dev/) for schema validation
  - [vue-i18n](https://github.com/intlify/vue-i18n) for internationalization

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Comfy-Org/ComfyUI_frontend.git
   cd ComfyUI_frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment (optional):
   Create a `.env` file in the project root based on the provided [.env.example](.env.example) file.

   **Note about ports**: By default, the dev server expects the ComfyUI backend at `localhost:8188`. If your ComfyUI instance runs on a different port, update this in your `.env` file.

### Dev Server Configuration

To launch ComfyUI and have it connect to your development server:

```bash
python main.py --port 8188
```

### Git pre-commit hooks

Run `npm run prepare` to install Git pre-commit hooks. Currently, the pre-commit hook is used to auto-format code on commit.

### Dev Server

- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server
- Run `npm run dev:electron` to start the dev server with electron API mocked

#### Access dev server on touch devices

Enable remote access to the dev server by setting `VITE_REMOTE_DEV` in `.env` to `true`.

After you start the dev server, you should see following logs:

```
> comfyui-frontend@1.3.42 dev
> vite


  VITE v5.4.6  ready in 488 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://172.21.80.1:5173/
  ➜  Network: http://192.168.2.20:5173/
  ➜  press h + enter to show help
```

Make sure your desktop machine and touch device are on the same network. On your touch device,
navigate to `http://<server_ip>:5173` (e.g. `http://192.168.2.20:5173` here), to access the ComfyUI frontend.

> ⚠️ IMPORTANT:
The dev server will NOT load JavaScript extensions from custom nodes. Only core extensions (built into the frontend) will be loaded. This is because the shim system that allows custom node JavaScript to import frontend modules only works in production builds. Python custom nodes still function normally. See [Extension Development Guide](docs/extensions/development.md) for details and workarounds. And See [Extension Overview](docs/extensions/README.md) for extensions overview.


## Development Workflow

### Architecture Decision Records

We document significant architectural decisions using ADRs (Architecture Decision Records). See [docs/adr/](docs/adr/) for all ADRs and the template for creating new ones.

### Backporting Changes to Release Branches

When you fix a bug that affects a version in feature freeze, we use an automated backport process to apply the fix to the release candidate branch.

#### Real Example

- Subgraphs feature was released in v1.24
- While developing v1.25, we discovered a bug in subgraphs
- v1.24 is in feature freeze (only accepting bug fixes, no new features)
- The fix needs to be applied to both main (v1.25) and the v1.24 release candidate

#### How to Backport Your Fix

1. Create your PR fixing the bug on `main` branch as usual
2. Before merging, add these labels to your PR:
   - `needs-backport` - triggers the automated backport workflow
   - `1.24` - targets the `core/1.24` release candidate branch
   
3. Merge your PR normally
4. The automated workflow will:
   - Create a new branch from `core/1.24`
   - Apply your changes to that branch
   - Open a new PR to `core/1.24`
   - Comment on your original PR with a link to the backport PR

#### When to Use Backporting

- Bug fixes for features already released
- Security fixes
- Critical issues affecting existing functionality
- Never for new features (these wait for the next release cycle)

#### Handling Conflicts

If the automated cherry-pick fails due to conflicts, the workflow will comment on your PR with:
- The list of conflicting files
- Instructions to manually cherry-pick to the release candidate branch

See [PR #4616](https://github.com/Comfy-Org/ComfyUI_frontend/pull/4616) for the actual subgraph bugfix that was backported from v1.25 to v1.24.

## Code Editor Configuration

### Recommended Setup

This project includes `.vscode/launch.json.default` and `.vscode/settings.json.default` files with recommended launch and workspace settings for editors that use the `.vscode` directory (e.g., VS Code, Cursor, etc.).

We've also included a list of recommended extensions in `.vscode/extensions.json`. Your editor should detect this file and show a human friendly list in the Extensions panel, linking each entry to its marketplace page.

### MCP Integrations

#### Playwright Browser Automation

The Playwright MCP server enables LLM coding assistants (like Copilot, Claude Code, etc.) to control and inspect web browsers programmatically. This allows assistants to navigate websites, take screenshots, and interact with web pages on your behalf.

For ComfyUI_frontend development, you can ask coding assistants to use Playwright screenshots to continuously verify that your code changes produce the expected visual results.

##### Setup for Claude Code

After installing dependencies with `npm i`, the Playwright MCP server will be automatically available when you start Claude Code locally.

Here's how Claude Code can use the Playwright MCP server to inspect the interface of the local development server (assuming you're running the dev server at `localhost:5173`):

```
> navigate to localhost:5173 and take a screenshot.
   tell me the items in the menubar

● I'll navigate to localhost:5173 and take a
  screenshot to see the menubar items.

● playwright:playwright_navigate (MCP)(url:       …
                                      "http://local
                                      host:5173")
  ⎿  Navigated to http://localhost:5173

● playwright:playwright_screenshot (MCP)(name: "lo…
                                        alhost_5173
                                        _menubar")

  ⎿ Screenshot saved to: ../../../Downloads/localho
    st_5173_menubar-2025-05-30T17-23-00-942Z.png
  ⎿  Screenshot also stored in memory with name:
     'localhost_5173_menubar'

● Read(../../../Downloads/localhost_5173_menubar-2…
      25-05-30T17-23-00-942Z.png)
  ⎿  Read image (94.3KB)

● Based on the screenshot, I can see the menubar at
   the top of the ComfyUI interface contains the
  following items:

  Main Menubar Items:
  - Workflow - Menu for workflow-related actions
  - Edit - Menu for editing operations
  - Help - Menu for help and documentation

  Additional UI Elements:
  - ComfyUI Logo - On the far left
  - Workflow Tab - Shows "Unsaved Workflow" with a
  dropdown and close button
  - Layout Controls - On the far right (grid view
  and hamburger menu icons)

  The interface shows a typical ComfyUI workflow
  graph with nodes like "Load Checkpoint", "CLIP
  Text Encode (Prompt)", "KSampler", and "Empty
  Latent Image" connected with colored cables.
```

## Testing

### Unit Tests

- `npm i` to install all dependencies
- `npm run test:unit` to execute all unit tests

### Component Tests

Component tests verify Vue components in `src/components/`.

- `npm run test:component` to execute all component tests

### Playwright Tests

Playwright tests verify the whole app. See [browser_tests/README.md](browser_tests/README.md) for details.

### Running All Tests

Before submitting a PR, ensure all tests pass:

```bash
npm run test:unit
npm run test:component
npm run test:browser
npm run typecheck
npm run lint
npm run format
```

## Code Style Guidelines

### TypeScript
- Use TypeScript for all new code
- Avoid `any` types - use proper type definitions
- Never use `@ts-expect-error` - fix the underlying type issue

### Vue 3 Patterns
- Use Composition API for all components
- Follow Vue 3.5+ patterns (props destructuring is reactive)
- Use `<script setup>` syntax

### Styling
- Use Tailwind CSS classes instead of custom CSS
- Follow the existing dark theme pattern: `dark-theme:` prefix (not `dark:`)

### Internationalization
- All user-facing strings must use vue-i18n
- Add translations to `src/locales/en/main.json`
- Use translation keys: `const { t } = useI18n(); t('key.path')`

## Icons

The project supports three types of icons, all with automatic imports (no manual imports needed):

1. **PrimeIcons** - Built-in PrimeVue icons using CSS classes: `<i class="pi pi-plus" />`
2. **Iconify Icons** - 200,000+ icons from various libraries: `<i-lucide:settings />`, `<i-mdi:folder />`
3. **Custom Icons** - Your own SVG icons: `<i-comfy:workflow />`

Icons are powered by the unplugin-icons system, which automatically discovers and imports icons as Vue components. Custom icons are stored in `src/assets/icons/custom/`.

For detailed instructions and code examples, see [src/assets/icons/README.md](src/assets/icons/README.md).

## Working with litegraph.js

Since Aug 5, 2025, litegraph.js is now integrated directly into this repository. It was merged using git subtree to preserve the complete commit history ([PR #4667](https://github.com/Comfy-Org/ComfyUI_frontend/pull/4667), [ADR](docs/adr/0001-merge-litegraph-into-frontend.md)).

### Important Notes

- **Issue References**: Commits from the original litegraph repository may contain issue/PR numbers (e.g., #4667) that refer to issues/PRs in the original litegraph.js repository, not this one.
- **File Paths**: When viewing historical commits, file paths may show the original structure before the subtree merge. In those cases, just consider the paths relative to the new litegraph folder.
- **Contributing**: All litegraph modifications should now be made directly in this repository.

The original litegraph repository (https://github.com/Comfy-Org/litegraph.js) is now archived.

## Submitting Changes

### Pull Request Process

1. Ensure your branch is up to date with main
2. Run all tests and ensure they pass
3. Create a pull request with a clear title and description
4. Use conventional commit format for PR titles:
   - `[feat]` for new features
   - `[fix]` for bug fixes
   - `[docs]` for documentation
   - `[refactor]` for code refactoring
   - `[test]` for test additions/changes
   - `[chore]` for maintenance tasks

### PR Description Template

```
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Component tests pass
- [ ] Browser tests pass (if applicable)
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes
```

### Review Process

1. All PRs require at least one review
2. Address review feedback promptly
3. Keep PRs focused - one feature/fix per PR
4. Large features should be discussed in an issue first

## Questions?

If you have questions about contributing:
- Check existing issues and discussions
- Ask in our [Discord](https://discord.com/invite/comfyorg)
- Open a new issue for clarification

Thank you for contributing to ComfyUI Frontend!