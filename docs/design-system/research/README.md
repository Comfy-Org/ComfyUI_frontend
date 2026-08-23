# External Pattern Research

External websites are evidence for a proposed Comfy pattern, not sources to
copy directly. Create one Markdown file per consequential pattern before using
research to design a new component.

Use this machine-readable frontmatter:

```yaml
---
id: research.pattern-name
status: proposed
problem: Short user problem
owner: Team or person
reviewed: YYYY-MM-DD
references:
  - https://example.com/path
decision: pending
target_surface: website
---
```

The body must record:

1. The repeated user problem, independent of any site's styling.
2. At least two references for a consequential pattern, with access dates.
3. Interaction anatomy and default, hover, focus, active, disabled, loading,
   empty, and error states that apply.
4. Responsive and keyboard behavior.
5. Accessibility observations.
6. The proposed Comfy component stack and semantic token roles.
7. What must not be copied: branding, copy, assets, source code, or distinctive
   styling.
8. A decision of `adopt`, `adapt`, `feature-local`, or `reject` after review.

An `adopt` or `adapt` decision still requires an approved component contract
under the target surface before page code may use the pattern.
