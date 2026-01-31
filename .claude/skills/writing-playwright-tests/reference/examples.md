# Example Test Files

Real test files to reference when writing new tests. **Always check these first.**

## By Feature

| Feature                 | File                                            | Key Patterns                          |
| ----------------------- | ----------------------------------------------- | ------------------------------------- |
| Widget interactions     | `browser_tests/tests/widget.spec.ts`            | Boolean, slider, image, combo widgets |
| Node selection/dragging | `browser_tests/tests/interaction.spec.ts`       | Click, drag, multi-select             |
| Copy/paste              | `browser_tests/tests/copyPaste.spec.ts`         | Ctrl+C/V, clipboard                   |
| Node search box         | `browser_tests/tests/nodeSearchBox.spec.ts`     | Filters, search, node creation        |
| Settings/themes         | `browser_tests/tests/colorPalette.spec.ts`      | setSetting, color changes             |
| Templates               | `browser_tests/tests/templates.spec.ts`         | Route mocking, template loading       |
| Execution               | `browser_tests/tests/execution.spec.ts`         | Queue prompt, WebSocket               |
| Subgraphs               | `browser_tests/tests/subgraph.spec.ts`          | Navigation, I/O slots                 |
| Undo/redo               | `browser_tests/tests/changeTracker.spec.ts`     | Change transactions                   |
| Keybindings             | `browser_tests/tests/keybindings.spec.ts`       | Custom shortcuts                      |
| Workflow sidebar        | `browser_tests/tests/sidebar/workflows.spec.ts` | Save, rename, switch                  |
| Graph validation        | `browser_tests/tests/graph.spec.ts`             | Link fixing, validation               |

## By Pattern

### Loading Workflows

```bash
grep -r "loadWorkflow" browser_tests/tests/ --include="*.spec.ts" | head -10
```

### Canvas Interactions

```bash
grep -r "nextFrame" browser_tests/tests/ --include="*.spec.ts" | head -10
```

### Node References

```bash
grep -r "getNodeRefsByType\|getNodeRefById" browser_tests/tests/ --include="*.spec.ts" | head -10
```

### Settings Changes

```bash
grep -r "setSetting" browser_tests/tests/ --include="*.spec.ts" | head -10
```

### Mocking API Routes

```bash
grep -r "page.route" browser_tests/tests/ --include="*.spec.ts" | head -10
```

### Screenshot Tests

```bash
grep -r "toHaveScreenshot" browser_tests/tests/ --include="*.spec.ts" | head -10
```

## Key Fixture Files

| Purpose         | Path                                                      |
| --------------- | --------------------------------------------------------- |
| Main fixture    | `browser_tests/fixtures/ComfyPage.ts`                     |
| Mouse helper    | `browser_tests/fixtures/ComfyMouse.ts`                    |
| Node reference  | `browser_tests/fixtures/utils/litegraphUtils.ts`          |
| Search box      | `browser_tests/fixtures/components/ComfyNodeSearchBox.ts` |
| Sidebar tab     | `browser_tests/fixtures/components/SidebarTab.ts`         |
| Settings dialog | `browser_tests/fixtures/components/SettingDialog.ts`      |
| Action bar      | `browser_tests/helpers/actionbar.ts`                      |
| Templates       | `browser_tests/helpers/templates.ts`                      |

## Finding Similar Tests

Before writing a new test, search for similar patterns:

```bash
# Find tests for a specific node type
grep -r "KSampler\|CLIPTextEncode" browser_tests/tests/

# Find tests using specific fixture method
grep -r "connectOutput\|connectWidget" browser_tests/

# Find tests with specific tag
grep -r '@screenshot\|@mobile' browser_tests/tests/

# Find tests that mock API
grep -r "route.*fulfill" browser_tests/tests/
```

## Asset Examples

```
browser_tests/assets/
├── default.json                    # Basic workflow
├── widgets/
│   ├── boolean_widget.json         # Toggle widgets
│   ├── slider_widget.json          # Slider/number widgets
│   └── combo_widget.json           # Dropdown widgets
├── nodes/
│   ├── single_ksampler.json        # Single node workflow
│   └── primitive.json              # Primitive node tests
├── subgraphs/
│   └── basic-subgraph.json         # Subgraph navigation
└── execution/
    └── simple.json                 # Execution tests
```

## Documentation Files

| File                      | Contains                |
| ------------------------- | ----------------------- |
| `browser_tests/README.md` | Overview, running tests |
| `browser_tests/AGENTS.md` | Agent-specific guidance |
| `browser_tests/CLAUDE.md` | Claude-specific context |
