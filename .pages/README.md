# GitHub Pages Deployment

This document describes the GitHub Pages deployment setup for ComfyUI Frontend development tools.

## Overview

The project automatically deploys the following development tools to GitHub Pages on every merge to the `main` branch:

- **Storybook** - Interactive component library and design system documentation
- **Nx Dependency Graph** - Visual representation of project dependencies
- **Test Coverage Reports** - Code coverage from Vitest unit tests
- **Vitest Results** - Interactive test results and reports
- **Knip Report** - Unused code and dependency analysis

## Accessing the Tools

Once deployed, all tools are accessible from a single landing page at:
```
https://comfy-org.github.io/ComfyUI_frontend/
```

## Primary Use Case: Storybook for Design Team

The primary motivation for this deployment is to provide the design team with a consistent, bookmarkable URL to reference the latest component system state. Instead of sharing PR-specific Storybook builds, the design team can always access the latest approved components from the main branch.

## Deployment Workflow

The deployment is managed by the `.github/workflows/release-pages.yml` workflow, which:

1. **Triggers on**:
   - Push to `main` branch
   - Manual workflow dispatch

2. **Build Process**:
   - Installs dependencies with pnpm
   - Runs `scripts/build-pages.sh` to generate Storybook, Nx dependency graph, Vitest reports, coverage, and Knip analysis
   - Creates a landing page with links to all tools

3. **Deployment**:
   - Uses GitHub Pages deploy action
   - Deploys to `gh-pages` branch
   - Available at the GitHub Pages URL

## Workflow Details

### Build Steps

The build script handles optional tooling gracefully—if an individual tool fails to build, the remainder of the deployment still proceeds and the failure is logged as a warning.

#### Storybook (Required)
```bash
pnpm build-storybook --output-dir dist/storybook
```

#### Nx Graph (Optional)
```bash
pnpm nx graph --file=dist/nx-graph/index.html
```

#### Test Coverage (Optional)
```bash
pnpm exec vitest --run --coverage --coverage.reporter=html
```

#### Vitest Results (Optional)
```bash
pnpm exec vitest --run --reporter=html --outputFile dist/vitest-ui/index.html
```

#### Knip Report (Optional)
```bash
pnpm knip --reporter json
```

### Permissions

The workflow requires the following permissions:
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

## Manual Deployment

You can manually trigger a deployment from the GitHub Actions tab:

1. Go to Actions → Deploy to GitHub Pages
2. Click "Run workflow"
3. Select the `main` branch
4. Click "Run workflow"

## Troubleshooting

### Storybook Build Fails

If the Storybook build fails:
1. Check that all Storybook stories are syntactically correct
2. Verify that all components can be imported
3. Run `pnpm build-storybook` locally to reproduce the issue

### Other Tools Fail

Since all tools except Storybook are marked with `continue-on-error: true`, they will not prevent deployment. If a tool consistently fails:

1. Check the GitHub Actions logs for the specific error
2. Test the build command locally
3. Consider adjusting the build command in the workflow

### GitHub Pages Not Updating

If changes aren't reflected on the live site:

1. Check the workflow run in the Actions tab
2. Verify that the deployment step succeeded
3. GitHub Pages can take a few minutes to update
4. Clear your browser cache or try an incognito window

## Maintenance

### Adding New Tools

To add a new development tool to the deployment:

1. Add a new build step in `.github/workflows/release-pages.yml`
2. Ensure the output goes to a subdirectory of `dist/`
3. Add `continue-on-error: true` if the tool is optional
4. Update the landing page `dist/index.html` with a link to the new tool

### Removing Tools

To remove a tool from deployment:

1. Remove the build step from the workflow
2. Remove the corresponding link from the landing page

## Cost Considerations

GitHub Pages is free for public repositories and includes:
- 1 GB storage
- 100 GB bandwidth per month
- 10 builds per hour

This should be more than sufficient for the development tools deployment.

## Security

The deployment only includes static, built artifacts:
- No source code is directly exposed
- No secrets or credentials are included
- All content is publicly accessible (appropriate for public repo)

## Related Documentation

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Storybook Documentation](https://storybook.js.org/docs)
- [Nx Documentation](https://nx.dev)
- [Vitest Documentation](https://vitest.dev)
- [Knip Documentation](https://knip.dev)