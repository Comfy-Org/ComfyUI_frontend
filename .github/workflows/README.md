# GitHub Workflows Documentation

## Naming Convention

All workflow files follow a consistent naming pattern for improved organization and discoverability.

### File Naming Format

```
<prefix>-<descriptive-name>.yaml
```

**Rules:**
1. Use `.yaml` extension consistently (not `.yml`)
2. Use lowercase letters only
3. Use hyphens (`-`) as word separators
4. Start with a category prefix (see below)
5. Follow prefix with a descriptive name that clearly indicates the workflow's purpose

### Category Prefixes

| Prefix | Category | Purpose | Example |
|--------|----------|---------|---------|
| `ci-` | Continuous Integration | Testing, linting, validation workflows | `ci-tests-e2e.yaml` |
| `release-` | Release Management | Version bumps, release branches, release drafts | `release-version-bump.yaml` |
| `pr-` | PR Automation | PR-specific workflows triggered by labels | `pr-claude-review.yaml` |
| `types-` | Type Generation | TypeScript type generation and updates | `types-registry-api.yaml` |
| `i18n-` | Internationalization | Locale and translation updates | `i18n-update-core.yaml` |

## Workflow Organization

### Test Workflows (`ci-tests-*`)
- `ci-tests-e2e.yaml` - End-to-end testing with Playwright
- `ci-tests-unit.yaml` - Unit and component testing with Vitest
- `ci-tests-storybook.yaml` - Storybook build and visual regression testing
- `ci-tests-*-forks.yaml` - Fork-safe deployment workflows (deploy results without exposing secrets)

### PR Label Workflows (`pr-*`)
These workflows are triggered when specific labels are added to PRs:

| Workflow | Trigger Label | Purpose |
|----------|---------------|---------|
| `pr-backport.yaml` | `needs-backport` | Cherry-pick PRs to release branches |
| `pr-claude-review.yaml` | `claude-review` | AI-powered code review |
| `pr-playwright-snapshots.yaml` | `New Browser Test Expectations` | Update visual test snapshots |

## Workflow Triggers

### Common Trigger Patterns

| Trigger Type | Use Case | Example |
|--------------|----------|---------|
| `push` to main/master | Production CI/CD | Deploy to production |
| `pull_request` | PR validation | Run tests, linting |
| `workflow_dispatch` | Manual execution | On-demand deployments |
| `repository_dispatch` | External triggers | API type updates |
| `workflow_run` | Chain workflows | Fork deployments |
| `schedule` | Periodic tasks | Nightly builds |
| Label added | Conditional actions | Review requests, snapshots |

### Branch Protection Patterns

- **Main branches**: `main`, `master`
- **Release branches**: `core/**`, `release/**`
- **Development branches**: `dev/**`, `develop/**`
- **Desktop branches**: `desktop/**`
- **WIP exclusion**: `!**wip/**`, `!wip/**`

## Best Practices

1. **Consistency**: Always use the naming convention for new workflows
2. **Documentation**: Update this README when adding new prefixes or patterns
3. **Permissions**: Use minimal required permissions for security
4. **Caching**: Leverage GitHub Actions cache for dependencies and build artifacts
5. **Concurrency**: Use concurrency groups to prevent duplicate runs
6. **Secrets**: Never hardcode secrets; use GitHub Secrets
7. **Fork Support**: Consider fork limitations when designing workflows
8. **Error Handling**: Include proper error handling and status checks
9. **Reusability**: Use workflow_call for shared logic across workflows

## External Dependencies

- **Cloudflare Pages**: Deployment platform for previews and test reports
- **Chromatic**: Visual regression testing for Storybook
- **OpenAI API**: Translation generation for i18n workflows
- **PyPI**: Python package distribution
- **npm Registry**: TypeScript types distribution
- **Claude API**: AI code review