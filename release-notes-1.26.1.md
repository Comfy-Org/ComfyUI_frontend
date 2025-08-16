# Release Notes for v1.26.1

## Version Change
**v1.26.0** → **v1.26.1** (patch release)

## Summary
This patch release includes important bug fixes for subgraph functionality, UI improvements, and workflow management enhancements. It addresses critical issues with subgraph node operations, improves the workflow tab preview feature, and includes various quality-of-life improvements.

## Changelog

### 🐛 Bug Fixes
- **Fix Alt-Click-Drag-Copy of Subgraph Nodes** (#4879) - Resolved issue with copying subgraph nodes using Alt+Click+Drag
- **Fix More menu visibility** (#4837) - Hide More menu when no submenu items are visible
- **Fix Desktop User Guide menu in web builds** (#4828) - Hide Desktop User Guide menu item in web builds
- **Fix execution breaks on multi/any-type slots** (#4864) - Fixed execution issues with multi/any-type slots
- **Fix Alt+click create reroute** (#4863, #4831) - Fixed reroute creation with Alt+click, including high-DPI display support
- **Fix disconnection from subgraph inputs** (#4800) - Resolved issues with disconnecting subgraph inputs
- **Fix subgraph I/O slot rename dialog** (#4852) - Fixed stale label content in rename dialog
- **Fix Simplified Chinese Translation** (#4865) - Corrected translation issues

### 🚀 Features
- **Replace manual clamp function with lodash** (#4874) - Improved code maintainability by using lodash utility
- **Add preview to workflow tabs** (#4290) - Added workflow preview functionality to tabs
- **Enable double-click on subgraph slot labels for renaming** (#4833) - Improved UX for renaming subgraph slots
- **Add smooth slide-up animation to SelectionToolbox** (#4832) - Enhanced UI with smooth animations
- **Support preview display on subgraphNodes** (#4814) - Added preview support for subgraph nodes
- **Keyboard Shortcut Bottom Panel** (#4635) - Added new keyboard shortcut panel

### 🔧 Maintenance & Refactoring
- **Remove unused omitBy function** (#4886) - Code cleanup
- **Reorder subgraph context menu items** (#4870) - Improved menu organization
- **Remove unused Litegraph context menu options** (#4867) - Cleaned up unused menu items
- **Rename subgraph widgets when slot is renamed** (#4821) - Improved consistency
- **Remove subgraphs from add node context menu** (#4820) - Simplified context menu
- **Remove 5 unused settings from apiSchema** (#4811) - Code cleanup

### 📚 Documentation
- **Add AGENTS.md file** (#4858) - Added documentation for agents
- **Improve icon documentation with practical examples** (#4810) - Enhanced documentation

### 🔨 CI/DevOps Improvements
- **Add chromium-0.5x to test matrix** (#4880) - Expanded test coverage
- **Pin third party GH actions to specific SHAs** (#4878) - Improved CI security
- **Exclude vue-nodes-migration branch from playwright tests** (#4844) - Optimized CI
- **Handle fork PRs in lint-and-format workflow** (#4819) - Fixed CI for fork PRs
- **Merge ESLint and Prettier workflows with auto-fix** (#4638) - Streamlined CI workflows
- **Correct branch protection status contexts for RC branches** (#4829) - Fixed CI configuration

## Testing Performed
- ✅ Full test suite (unit, component)
- ✅ TypeScript compilation
- ✅ Linting checks
- ✅ Build verification
- ✅ Security audit

## Distribution Channels
- GitHub Release (with dist.zip)
- PyPI Package (comfyui-frontend-package)
- npm Package (@comfyorg/comfyui-frontend-types)

## Post-Release Tasks
- [ ] Verify all distribution channels
- [ ] Update external documentation
- [ ] Monitor for issues