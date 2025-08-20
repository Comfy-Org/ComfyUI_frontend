# Storybook Issue Tracking System

This directory contains resources for tracking and organizing all Storybook-related work in the ComfyUI Frontend repository.

## 📋 Components

### 1. Issue Template (`.github/ISSUE_TEMPLATE/storybook-improvement.yaml`)
A structured GitHub issue template specifically for Storybook-related improvements and requests.

**Features:**
- Categorizes improvements (Component Stories, Configuration, Visual Testing, etc.)
- Priority levels (Low → Critical)
- Component impact tracking
- Implementation ideas and examples

**Usage:** When creating new issues related to Storybook, use this template to ensure consistent formatting and complete information.

### 2. Tracking Documentation (`STORYBOOK_TRACKING_ISSUE.md`)
Comprehensive documentation listing all 27+ Storybook-related PRs, organized by category.

**Contains:**
- Current status overview
- PRs organized by category (Setup, Stories, Themes, Config, etc.)
- Upcoming priorities roadmap
- Contribution guidelines
- Resource links

## 🔧 How to Use

### For New Storybook Issues
1. Go to [GitHub Issues → New Issue](https://github.com/Comfy-Org/ComfyUI_frontend/issues/new/choose)
2. Select "Storybook Improvement" template
3. Fill out the structured form
4. Add `area:storybook` label if not automatically applied

### For Tracking Progress
1. Reference the tracking documentation in `STORYBOOK_TRACKING_ISSUE.md`
2. Create a GitHub issue using this content as the body
3. Use labels: `area:storybook`, `tracking`
4. Pin the issue for easy access

### For Contributors
1. Check existing tracking issue for current priorities
2. Follow guidelines in `.storybook/README.md` and `.storybook/CLAUDE.md`
3. Reference the tracking issue number in related PRs
4. Update tracking documentation when completing work

## 📚 Related Resources

- **Storybook Documentation**: `.storybook/README.md`
- **Developer Guidelines**: `.storybook/CLAUDE.md`
- **Component Examples**: `src/components/*/\*.stories.ts`
- **Visual Testing**: Chromatic integration in CI/CD workflows

## 🎯 Purpose

This system helps:
- **Organize** all Storybook-related work in one place
- **Track** progress across multiple PRs and initiatives  
- **Prioritize** improvements based on impact and urgency
- **Facilitate** collaboration between contributors
- **Maintain** comprehensive documentation of Storybook evolution