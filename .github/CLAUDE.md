# ComfyUI Frontend - Claude Review Context

This file provides additional context for the automated PR review system.

## Quick Reference

### PrimeVue Component Migrations

When reviewing, flag these deprecated components:
- `Dropdown` → Use `Select` from 'primevue/select'
- `OverlayPanel` → Use `Popover` from 'primevue/popover'
- `Calendar` → Use `DatePicker` from 'primevue/datepicker'
- `InputSwitch` → Use `ToggleSwitch` from 'primevue/toggleswitch'
- `Sidebar` → Use `Drawer` from 'primevue/drawer'
- `Chips` → Use `AutoComplete` with multiple enabled and typeahead disabled
- `TabMenu` → Use `Tabs` without panels
- `Steps` → Use `Stepper` without panels
- `InlineMessage` → Use `Message` component

### API Utilities Reference

- `api.apiURL()` - Backend API calls (/prompt, /queue, /view, etc.)
- `api.fileURL()` - Static file access (templates, extensions)
- `$t()` / `i18n.global.t()` - Internationalization
- `DOMPurify.sanitize()` - HTML sanitization

## Review Scope

This automated review performs comprehensive analysis including:
- Architecture and design patterns
- Security vulnerabilities
- Performance implications
- Code quality and maintainability
- Integration concerns

For implementation details, see `.claude/commands/comprehensive-pr-review.md`.