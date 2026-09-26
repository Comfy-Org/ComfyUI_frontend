# Figma to Code Component Map

This map records verified discovery results from the live published `Comfy
Design System` library. It is optimized for selecting a code primitive before
recreating mockup markup. Search the live library for variants and properties;
component keys identify the published asset but do not encode its full contract.

Observed 2026-08-20. `Mapped` means a reusable code family exists; it does not
claim every Figma variant is implemented.

| Figma asset          | Component key                              | Code family                                            | Status   | Notes                                                                    |
| -------------------- | ------------------------------------------ | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| Button/Default       | `8728a15757be77541246aa641d9e96c5876e99b7` | `src/components/ui/button/Button.vue`                  | Mapped   | Use supported `variant` and `size` values before extending them.         |
| Button/Text          | `0f18aa8f66ef2505058b52b81e70afff5c46f5c0` | `src/components/ui/button/Button.vue`                  | Mapped   | Use a text-only Button variant.                                          |
| SelectButton         | `bf615e1a7325c97c49715d275e156d55d010b107` | `src/components/ui/toggle-group/`                      | Validate | Confirm single versus multiple selection semantics.                      |
| TextInput            | `4c4a38c565a17dc14aa0f3df4baf265efe6a82a4` | `src/components/ui/input/Input.vue`                    | Mapped   | Labels, descriptions, and validation belong in a composed field pattern. |
| SearchInput          | `47a1923a288c3f677c29e75d26eacc9dd39239e9` | `src/components/ui/search-input/`                      | Mapped   | Async and autocomplete variants also exist in code.                      |
| NumberInput          | `f5e068848ac701de777e34c47e9f70698d58d30b` | `src/components/ui/stepper/FormattedNumberStepper.vue` | Validate | Scrubbable number input is another established option outside `ui`.      |
| InputFull            | `c2857598f1d433625e2ac75a819ab49f323f8db9` | Input plus field composition                           | Gap      | Document a shared field composition if this repeats.                     |
| TextArea             | `e9f735150997871b62d1641765ab3f39817d6977` | `src/components/ui/textarea/Textarea.vue`              | Mapped   | Preserve resize and validation requirements from the feature.            |
| ColorPicker          | `9136eec69189be9ba50e7038e49fc912ca362ccf` | `src/components/ui/color-picker/`                      | Mapped   | Use the family root unless panel-level composition is required.          |
| Dialog Modal         | `39f76eb8ca1c77035c1ba94092e55f821dd64e23` | `src/components/ui/dialog/`                            | Mapped   | Assemble the compound dialog parts; sizes are owned by DialogContent.    |
| Tooltip              | `c1a6554e5f36d4a61f7770bd4add31d513442c51` | `src/components/ui/tooltip/AccessibleTooltip.vue`      | Mapped   | Tooltip text must not be the only accessible name.                       |
| Tabs                 | `01409222dd723ffffe0fade0238cdcbd4e385a3f` | `src/components/tab/`                                  | Mapped   | Validate keyboard behavior when adding a new usage.                      |
| Nav Item             | `c30618681df8196baa064adfde978826270534ee` | `src/components/widget/nav/NavItem.vue`                | Mapped   | Use only for the matching navigation context.                            |
| Collapsable Nav Item | `4707c69c50dec86da3a947b8482e9adc7cd5bcb1` | Navigation composition                                 | Gap      | Promote only after the composition repeats.                              |
| SliderHandle         | `09a5b7e1651a4bca814d49d42b6bcaf272804e0f` | `src/components/ui/slider/Slider.vue`                  | Mapped   | The handle is an implementation detail of Slider.                        |
| Row                  | `72501cdc56871ae1cf1f9bf2ade2addad3599233` | Context-dependent list or table row                    | Validate | Match semantics before choosing an implementation.                       |

## Mapping rules

- One Figma component can map to a code family rather than one Vue file.
- `Validate` requires inspecting the live Figma properties and the code prop
  interface in the context of the mockup.
- `Gap` does not authorize a one-off replica. Follow the missing-component path
  in `MOCKUP_WORKFLOW.md`.
- Add Code Connect only after the Figma and code contracts are confirmed to
  represent the same component.
