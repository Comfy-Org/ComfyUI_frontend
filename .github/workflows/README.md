# GitHub Workflows

## Naming Convention

Workflow files follow a consistent naming pattern: `<prefix>-<descriptive-name>.yaml`

### Category Prefixes

| Prefix     | Purpose                             | Example                              |
| ---------- | ----------------------------------- | ------------------------------------ |
| `ci-`      | Testing, linting, validation        | `ci-tests-e2e.yaml`                  |
| `release-` | Version management, publishing      | `release-version-bump.yaml`          |
| `pr-`      | PR automation (triggered by labels) | `pr-claude-review.yaml`              |
| `api-`     | External Api type generation        | `api-update-registry-api-types.yaml` |
| `i18n-`    | Internationalization updates        | `i18n-update-core.yaml`              |

## Documentation

Each workflow file contains comments explaining its purpose, triggers, and behavior. For specific details about what each workflow does, refer to the comments at the top of each `.yaml` file.

For GitHub Actions documentation, see [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows).

## Manual API Changelog Generation

The `manual-api-changelog.yaml` workflow allows you to generate API changelogs by comparing any two versions of the ComfyUI Frontend package.

### Usage

#### Via GitHub Actions UI

1. Go to **Actions** tab in the repository
2. Select **Manual API Changelog Generation** from the workflows list
3. Click **Run workflow** button
4. Fill in the inputs:
   - **Previous version**: The earlier version (e.g., `1.29.0` or `v1.29.0`)
   - **Current version**: The later version (e.g., `1.30.2` or `v1.30.2`)
   - **Create PR**: Check this to automatically create a pull request with the changelog

#### Via GitHub CLI

```bash
# Basic usage - just generate changelog
gh workflow run manual-api-changelog.yaml \
  -f from_version=1.29.0 \
  -f to_version=1.30.2 \
  -f create_pr=false

# Generate changelog and create PR
gh workflow run manual-api-changelog.yaml \
  -f from_version=1.29.0 \
  -f to_version=1.30.2 \
  -f create_pr=true
```

### What It Does

1. **Validates Inputs**: Checks that version formats are valid (X.Y.Z) and tags exist
2. **Builds Both Versions**: Checks out each version tag, installs dependencies, and builds TypeScript types
3. **Generates Snapshots**: Creates structured JSON snapshots of the public API surface for each version
4. **Compares APIs**: Analyzes differences and categorizes as:
   - ⚠️ **Breaking changes** (removals, signature changes)
   - ✨ **Additions** (new interfaces, methods, properties)
   - 🔄 **Modifications** (non-breaking changes)
5. **Uploads Artifact**: Saves the changelog and snapshots as a workflow artifact (90-day retention)
6. **Creates PR** (optional): Generates a draft PR to update `docs/API-CHANGELOG.md`

### Output

#### Workflow Artifacts

Every run produces an artifact containing:
- `CHANGELOG-{from}-to-{to}.md` - Human-readable changelog
- `from.json` - API snapshot of the earlier version
- `to.json` - API snapshot of the later version

**Retention**: 90 days

#### Pull Request (Optional)

If `create_pr` is enabled and changes are detected:
- Creates a draft PR with title: `[docs] API Changelog: v{from} → v{to}`
- Updates `docs/API-CHANGELOG.md` with the new changelog entry
- Includes detailed metadata and review instructions
- Labeled with `documentation`

### Example Changelog Output

```markdown
## v1.30.2 (2025-11-04)

Comparing v1.29.0 → v1.30.2. This changelog documents changes to the public API surface.

### ✨ Additions

**Type Aliases**
- `WorkflowId`

**Interfaces**
- `ExtensionMetadata`
  - Members: `id`, `name`, `version`, `description`

### 🔄 Modifications

> **Note**: Some modifications may be breaking changes.

**Interfaces**
- `ComfyApi`
  - ✨ Added member: `queuePromptAsync`
  - ✨ Added member: `cancelPrompt`
  - ⚠️ **Breaking**: Removed member: `queuePrompt`

**Enums**
- `NodeStatus`
  - ✨ Added enum value: `ERROR`
  - ✨ Added enum value: `COMPLETED`
```

### Use Cases

#### 1. Generate Changelog for Missed Releases

If the automatic workflow failed or was skipped for a release:

```bash
gh workflow run manual-api-changelog.yaml \
  -f from_version=1.28.0 \
  -f to_version=1.29.0 \
  -f create_pr=true
```

#### 2. Compare Non-Adjacent Versions

To see cumulative changes across multiple releases:

```bash
gh workflow run manual-api-changelog.yaml \
  -f from_version=1.25.0 \
  -f to_version=1.30.2 \
  -f create_pr=false
```

#### 3. Test Upcoming Changes

Compare current `main` branch against the latest release (requires creating a temporary tag):

```bash
# Create temporary tag for current main
git tag v1.31.0-preview
git push origin v1.31.0-preview

# Run comparison
gh workflow run manual-api-changelog.yaml \
  -f from_version=1.30.2 \
  -f to_version=1.31.0-preview \
  -f create_pr=false

# Clean up temporary tag
git tag -d v1.31.0-preview
git push origin :refs/tags/v1.31.0-preview
```

#### 4. Audit Historical Changes

Generate changelogs for documentation purposes:

```bash
# Compare multiple version pairs
for from in 1.26.0 1.27.0 1.28.0 1.29.0; do
  to=$(echo "$from" | awk -F. '{print $1"."$2+1".0"}')
  gh workflow run manual-api-changelog.yaml \
    -f from_version=$from \
    -f to_version=$to \
    -f create_pr=false
done
```

### Validation

The workflow validates:
- ✅ Version format matches semantic versioning (X.Y.Z)
- ✅ Both version tags exist in the repository
- ✅ Tags reference valid commits with buildable code

If validation fails, the workflow exits early with a clear error message.

### Limitations

- **Tag requirement**: Both versions must have corresponding `vX.Y.Z` git tags
- **Build requirement**: Both versions must have functional build processes
- **Type files**: Requires `dist/index.d.ts` to exist after building
- **Scripts**: Requires `scripts/snapshot-api.ts` and `scripts/compare-api-snapshots.ts` to be present

### Related Workflows

- **[Release API Changelogs](.github/workflows/release-api-changelogs.yaml)**: Automatic changelog generation triggered by NPM releases
- **[Release NPM Types](.github/workflows/release-npm-types.yaml)**: Publishes type definitions and triggers automatic changelog

### Troubleshooting

#### "Tag does not exist" error

Ensure the version exists as a git tag:

```bash
git tag -l 'v*' | grep 1.29.0
```

If missing, the version may not have been released yet.

#### "Build failed" error

Check that the version can be built successfully:

```bash
git checkout v1.29.0
pnpm install
pnpm build:types
```

#### No changes detected

If the workflow reports no changes but you expect some:
1. Check the artifact snapshots to verify they're different
2. Ensure you're comparing the correct versions
3. Review the comparison script logic in `scripts/compare-api-snapshots.ts`

#### PR not created

PR creation requires:
- `create_pr` input set to `true`
- Significant changes detected (more than just headers)
- `PR_GH_TOKEN` secret configured with appropriate permissions
