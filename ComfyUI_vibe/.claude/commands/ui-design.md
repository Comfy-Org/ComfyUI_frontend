# UI Design Agent

Create detailed UI component specifications for a PRD.

## Usage

```
/ui-design [path-to-prd]
```

Or run from within a PRD folder to design UI for that PRD.

## Role

As the UI Agent, you will:
1. Review PRD and UX specification
2. Define component hierarchy
3. Specify visual design details
4. Create component interfaces (props, events)
5. Ensure consistency with design system

## Process

### Step 1: Read Context

1. Read the PRD file (especially UX Specification)
2. Review existing components in `src/components/v2/`
3. Check design tokens in `src/assets/css/main.css`
4. Review type definitions in `src/types/`

### Step 2: Identify Components Needed

For each UI element in the user flow:
1. Can an existing component be reused?
2. Does an existing component need modification?
3. Is a new component needed?

### Step 3: Define Component Hierarchy

Map out the component tree:

```
FeatureRoot
├── FeatureHeader
│   ├── Title
│   └── CloseButton
├── FeatureContent
│   ├── SearchInput
│   └── ResultsList
│       └── ResultItem (repeated)
└── FeatureFooter
    └── ActionButtons
```

### Step 4: Specify Each Component

For each new component, define:

```typescript
// Component: FeatureName
// Location: src/components/v2/{category}/{FeatureName}.vue

interface Props {
  title: string
  items: Item[]
  isLoading?: boolean
}

interface Emits {
  'select': [item: Item]
  'close': []
}

// Slots
// - default: Main content
// - header: Custom header
// - footer: Custom footer
```

### Step 5: Define Visual Specifications

For each component, specify:

#### Layout
- Display type (flex, grid)
- Dimensions (width, height, min/max)
- Spacing (padding, margin, gap)

#### Colors (use semantic tokens)
- Background: `bg-surface-card`
- Text: `text-primary`, `text-secondary`
- Border: `border-surface-border`
- Hover: `hover:bg-surface-hover`

#### Typography
- Font size: `text-sm`, `text-base`, `text-lg`
- Font weight: `font-normal`, `font-medium`, `font-semibold`
- Line height: `leading-tight`, `leading-normal`

#### Effects
- Shadows: `shadow-sm`, `shadow-md`
- Transitions: `transition-colors duration-150`
- Border radius: `rounded`, `rounded-lg`

### Step 6: Generate UI Specification

Update the PRD's UI Specification section (Section 6) with:

```markdown
## 6. UI Specification

### 6.1 Component Hierarchy

```
FeaturePanel
├── PanelHeader
├── SearchSection
│   └── SearchInput
├── ResultsSection
│   └── ResultItem (v-for)
└── PanelFooter
```

### 6.2 Component Specifications

#### FeaturePanel

**Location:** `src/components/v2/feature/FeaturePanel.vue`

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| visible | boolean | false | Controls panel visibility |
| title | string | required | Panel title |

**Events:**
| Event | Payload | Description |
|-------|---------|-------------|
| close | void | Emitted when panel closes |

**Slots:**
| Slot | Description |
|------|-------------|
| default | Main content |

**Styles:**
```css
.feature-panel {
  @apply fixed right-0 top-0 h-full w-80;
  @apply bg-surface-card border-l border-surface-border;
  @apply shadow-lg;
}
```

#### SearchInput

**Location:** `src/components/v2/feature/SearchInput.vue`

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| modelValue | string | '' | Search query |
| placeholder | string | 'Search...' | Placeholder text |
| debounce | number | 300 | Debounce delay in ms |

**Events:**
| Event | Payload | Description |
|-------|---------|-------------|
| update:modelValue | string | v-model update |
| search | string | Debounced search triggered |

### 6.3 Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--panel-width` | 320px | Panel width |
| `--item-height` | 48px | List item height |
| `--transition-speed` | 150ms | Animation duration |

### 6.4 Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| < 640px (sm) | Full-width panel |
| >= 640px | Fixed 320px width |

### 6.5 Animation Specifications

| Animation | Property | Duration | Easing |
|-----------|----------|----------|--------|
| Panel open | transform | 200ms | ease-out |
| Panel close | transform | 150ms | ease-in |
| Hover | background | 150ms | ease |
```

## Output

Updates the PRD file with:
1. Complete UI Specification section
2. Component interfaces
3. Visual specifications

Creates `ui-spec.md` for detailed component documentation:
```
PRDs/active/P{X}-{feature-name}/
├── PRD.md       # Updated with UI spec
└── ui-spec.md   # Detailed component specs (if complex)
```

## Design System Reference

### Semantic Color Tokens
```css
/* Backgrounds */
bg-surface-card      /* Card/panel backgrounds */
bg-surface-hover     /* Hover states */
bg-surface-ground    /* Page background */

/* Text */
text-primary         /* Primary text */
text-secondary       /* Secondary text */
text-muted           /* Muted/hint text */

/* Borders */
border-surface-border /* Default borders */
border-surface-hover  /* Hover borders */
```

### Common Tailwind Classes
```css
/* Layout */
flex items-center justify-between
grid grid-cols-2 gap-4

/* Spacing */
p-2 p-4 px-3 py-2
m-2 mt-4 mb-2
gap-2 gap-4

/* Typography */
text-sm text-base text-lg
font-medium font-semibold
leading-tight leading-normal

/* Effects */
rounded rounded-lg rounded-full
shadow-sm shadow-md
transition-colors duration-150
```

## Checklist

- [ ] All components identified
- [ ] Props/events typed
- [ ] Colors use semantic tokens
- [ ] No `dark:` variants used
- [ ] Responsive behavior defined
- [ ] Animations specified
- [ ] Accessibility considered (focus states, ARIA)
- [ ] Follows existing patterns

## Next Steps

After UI design:
1. `/product-review` - Final product review
2. `/generate-tasks` - Create implementation tasks
3. Begin implementation
