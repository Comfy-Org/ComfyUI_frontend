# 📚 Storybook Development Tracking

This issue serves as a central hub for tracking all Storybook-related PRs and improvements in the ComfyUI Frontend repository.

## 🎯 Overview

Storybook is a crucial part of our component development workflow, enabling:
- Component isolation and development
- Visual documentation and testing  
- Automated visual regression testing with Chromatic
- Design system development and maintenance

## 📈 Current Status

**Storybook Setup**: ✅ Complete  
**Component Coverage**: 🔄 In Progress  
**Visual Testing**: ✅ Integrated with Chromatic  
**Documentation**: ✅ Comprehensive guides available  

## 📋 Storybook PRs by Category

### 🏗️ Initial Setup & Infrastructure
- **#4861** - [feat] Add Storybook setup and NodePreview story *(merged)*
  - Complete Storybook v8 setup with Vue 3 + Vite
  - Chromatic integration for visual testing
  - Comprehensive documentation and guidelines

### 📖 Component Stories & Documentation  
- **#4999** - [feat] 100+ more Stories for Common Components *(open)*
  - 76 story variants across 11 components
  - Covers STATIC → SIMPLE_PROPS → INTERACTIVE → COMPLEX tiers
- **#5034** - [feat] Add Storybook configuration and settings panel stories *(open)*  
  - Settings panel components with all input types
  - Responsive design and accessibility features
- **#5098** - [feat] Add comprehensive Storybook stories for custom UI components *(open)*
  - 12 custom UI components with interactive testing
  - Button, input, and layout component stories
- **#5122** - [docs] Add Storybook documentation *(open)*
  - Enhanced `.storybook/README.md` with comprehensive guidelines

### 🎨 Theme & Visual Improvements
- **#5088** - [feat] Add dark theme support for Storybook *(merged)*
  - Dark theme toggle with persistence
  - Smooth transitions and proper styling

### 🔧 Configuration & Build Optimizations
- **#5117** - [ci] Enhance CI/CD caching across all workflows *(open)*
  - Improved caching for Storybook builds
- **#5118** - [ci] Add retry logic to wrangler page deploy step *(open)*
  - Stability improvements for Storybook deployment

### 🚀 Features & Enhancements
- **#5119** - [feat] Add enhanced filter UI components *(open)*
  - SearchBox integration and improved MultiSelect
- **#5096** - [fix] Resolve breadcrumb and workflow tabs layout conflict *(open)*
  - Layout improvements affecting Storybook stories
- **#5113** - [fix] Reposition TaskItem info *(open)*
  - Component fixes that impact Storybook examples

### 🔨 Technical Improvements & Fixes
- **#5106** - Fix/widget ordering consistency *(open)*
  - Node widget improvements affecting stories
- **#5109** - Fix CopyToClipboard Issue *(open)*
  - Component fixes relevant to Storybook examples
- **#5092** - Add support for high-resolution wheel events *(open)*
  - Input handling improvements
- **#5115** - Fix: Shift+Click+Drag from outputs with Subgraph outputs *(open)*
  - Node interaction improvements
- **#5114** - Remove duplicate semantic labeling from issue templates *(open)*
  - Issue template improvements
- **#5102** - [fix] Invoke onRemove callback in LGraphNode.removeWidget method *(merged)*
  - Widget system improvements
- **#5099** - Remove PR checks workflows *(merged)*
  - CI/CD cleanup
- **#5103** - Update to latest version of workflow icon *(merged)*
  - Icon updates affecting stories
- **#5107** - [ci] Add caching support to format and knip commands *(merged)*
  - Build optimization improvements
- **#5108** - [refactor] Remove obsolete Kontext Edit Button *(merged)*
  - Component cleanup
- **#5110** - [chore] Ignore ./claude/settings.json *(merged)*
  - Development environment improvements
- **#5112** - [docs] Update browser tests README *(merged)*
  - Testing documentation improvements
- **#4908** - Modal Component & Custom UI Components *(merged)*
  - Foundation UI components used in stories

## 🎯 Upcoming Priorities

### High Priority
- [ ] Complete component story coverage for all major UI components
- [ ] Implement comprehensive visual regression testing
- [ ] Improve Storybook build performance and caching

### Medium Priority  
- [ ] Add interactive component documentation
- [ ] Enhance theme switching and customization
- [ ] Improve mobile responsiveness of stories

### Low Priority
- [ ] Add more sophisticated mock data patterns
- [ ] Implement component testing automation
- [ ] Explore advanced Storybook addons

## 🔄 How to Contribute

1. **Creating New Stories**: Follow guidelines in `.storybook/README.md` and `.storybook/CLAUDE.md`
2. **Improving Existing Stories**: Use the Storybook Improvement issue template
3. **Documentation**: Update relevant documentation when adding features
4. **Testing**: Ensure all stories build and render correctly

## 📚 Resources

- **Storybook Documentation**: `.storybook/README.md`
- **Developer Guidelines**: `.storybook/CLAUDE.md`  
- **Component Examples**: `src/components/*/\*.stories.ts`
- **Visual Testing**: Chromatic integration in CI/CD

---

*This issue is automatically maintained. Please reference this issue number when working on Storybook-related improvements.*