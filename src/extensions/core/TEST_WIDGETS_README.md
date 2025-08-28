# Test Widgets 节点使用说明

## 概述
这是一个专门用于测试 ComfyUI 各种 Widget 组件的测试节点。它包含了前端支持的所有 widget 类型，方便开发者测试和学习不同组件的使用方法。

## 如何使用

### 1. 启动应用
重新启动 ComfyUI 前端应用以加载新的扩展。

### 2. 添加测试节点
在节点搜索中输入 "Test Widgets" 或者在 "testing" 分类中找到 "Test Widgets" 节点。

### 3. 测试各种 Widget

#### 基础 Widget 类型 (Required)
- **string_widget**: 文本输入框
- **int_widget**: 整数滑块 (0-100)
- **float_widget**: 浮点数滑块 (0.0-10.0)
- **boolean_widget**: 布尔切换开关
- **combo_widget**: 下拉选择框
- **color_widget**: 颜色选择器
- **textarea_widget**: 多行文本输入
- **file_widget**: 文件上传
- **image_widget**: 图片显示
- **markdown_widget**: Markdown 编辑器

#### 高级 Widget 类型 (Optional)
- **selectbutton_widget**: 选择按钮组 (Small/Medium/Large/Extra Large)
- **multiselect_widget**: 多选组件 (颜色选择)
- **treeselect_widget**: 树形选择器 (水果/蔬菜分类)
- **chart_widget**: 图表组件
- **slider_widget**: 数值滑块
- **toggleswitch_widget**: 切换开关
- **button_widget**: 点击按钮

## Widget 配置示例

### SelectButton Widget
```typescript
selectbutton_widget: ['SELECTBUTTON', {
  values: ['Small', 'Medium', 'Large', 'Extra Large'],
  default: 'Medium'
}]
```

### MultiSelect Widget
```typescript
multiselect_widget: ['MULTISELECT', {
  values: ['Red', 'Green', 'Blue', 'Yellow', 'Purple'],
  default: ['Red', 'Blue']
}]
```

### TreeSelect Widget
```typescript
treeselect_widget: ['TREESELECT', {
  values: [
    {
      label: 'Fruits',
      value: 'fruits',
      children: [
        { label: 'Apple', value: 'apple' },
        { label: 'Orange', value: 'orange' }
      ]
    }
  ]
}]
```

## 输出
节点的输出会显示所有 widget 的当前值，以 JSON 格式呈现：

```json
{
  "string_widget": "Hello World",
  "int_widget": 42,
  "selectbutton_widget": "Medium",
  "multiselect_widget": ["Red", "Blue"],
  ...
}
```

## 开发用途
这个测试节点主要用于：

1. **Widget 开发测试**: 验证新开发的 widget 组件功能
2. **界面设计**: 查看不同 widget 的外观和交互效果
3. **配置学习**: 了解各种 widget 的配置参数
4. **功能演示**: 向其他开发者展示 ComfyUI 的 widget 能力

## 注意事项
- 这是一个开发和测试用的节点，不建议在生产工作流中使用
- 某些 widget (如 IMAGE) 可能需要实际的数据输入才能正常显示
- 按钮点击会触发 alert 提示，这是为了演示按钮功能

## 文件修改清单

在创建此测试组件过程中，对以下文件进行了修改：

### 📁 新增文件
- `src/extensions/core/testWidgets.ts` - 主测试节点文件
- `src/extensions/core/TEST_WIDGETS_README.md` - 本说明文档

### 🔧 修改文件

#### 1. `src/extensions/core/index.ts`
```diff
+ import './testWidgets'
```
**用途**: 注册测试扩展到核心扩展系统

#### 2. `src/schemas/nodeDef/migration.ts`
```diff
// 在 transformInputSpecV1ToV2 函数中添加
+ // Special handling for SELECTBUTTON to ensure options.values is properly set
+ if (inputSpecV1[0] === 'SELECTBUTTON' && options.values) {
+   result.options = {
+     ...result.options,
+     values: options.values
+   }
+ }
```
**用途**: 修复 SELECTBUTTON widget 的数据传递问题

#### 3. `src/renderer/extensions/vueNodes/widgets/components/WidgetSelectButton.vue`
```diff
// 模板部分
- v-bind="filteredProps"
+ :options="filteredProps.values || filteredProps.options || []"

// Script 部分添加了调试日志和数据处理
+ const filteredProps = computed(() => {
+   const filtered = filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
+   console.log('WidgetSelectButton filteredProps:', filtered)
+   console.log('Widget options:', props.widget.options)
+
+   // Ensure options array is available for SelectButton
+   if (filtered.values && Array.isArray(filtered.values)) {
+     filtered.options = filtered.values
+   }
+
+   return filtered
+ })
```
**用途**: 修复 PrimeVue SelectButton 组件的属性绑定问题

### 🔄 其他修改的文件
以下文件也被 git 记录为修改，但主要是开发过程中的临时修改：
- `src/components/graph/debug/VueNodeDebugPanel.vue`
- `src/composables/graph/useWidgetRenderer.ts`
- `src/constants/coreSettings.ts`
- `src/renderer/extensions/vueNodes/widgets/composables/useWidgetRenderer.ts`

## 完整还原指南

### 🗑️ 快速清理（推荐）
如果要完全移除测试组件和相关修改：

```bash
# 1. 删除新增的文件
rm src/extensions/core/testWidgets.ts
rm src/extensions/core/TEST_WIDGETS_README.md

# 2. 还原所有修改的文件
git checkout src/extensions/core/index.ts
git checkout src/schemas/nodeDef/migration.ts
git checkout src/renderer/extensions/vueNodes/widgets/components/WidgetSelectButton.vue

# 3. 清理其他临时修改（可选）
git checkout src/components/graph/debug/VueNodeDebugPanel.vue
git checkout src/composables/graph/useWidgetRenderer.ts
git checkout src/constants/coreSettings.ts
git checkout src/renderer/extensions/vueNodes/widgets/composables/useWidgetRenderer.ts

# 4. 重新启动应用
```

### 🛠️ 选择性保留
如果想保留 SelectButton 修复但移除测试组件：

```bash
# 1. 只删除测试相关文件
rm src/extensions/core/testWidgets.ts
rm src/extensions/core/TEST_WIDGETS_README.md

# 2. 只还原扩展注册
git checkout src/extensions/core/index.ts

# 3. 保留以下修复（这些是有用的bug修复）：
# - src/schemas/nodeDef/migration.ts
# - src/renderer/extensions/vueNodes/widgets/components/WidgetSelectButton.vue
```

### 📝 手动还原
如果不使用 git，可以手动还原：

#### `src/extensions/core/index.ts`
移除这一行：
```typescript
import './testWidgets'
```

#### `src/schemas/nodeDef/migration.ts`
删除 SELECTBUTTON 的特殊处理代码（第130-135行左右）

#### `src/renderer/extensions/vueNodes/widgets/components/WidgetSelectButton.vue`
- 将 `:options="filteredProps.values || filteredProps.options || []"` 改回 `v-bind="filteredProps"`
- 移除 console.log 调试语句
- 恢复原始的 `filteredProps` computed 函数

## 注意事项
- ⚠️ **SelectButton 修复很重要**: `migration.ts` 和 `WidgetSelectButton.vue` 的修改修复了实际的 bug，建议保留
- 🧹 **清理调试日志**: 如果保留修复，记得移除 console.log 调试语句
- 🔄 **重启应用**: 任何文件修改后都需要重新启动应用才能生效
- 💾 **备份重要修改**: 在还原前考虑是否需要保留某些有用的修复
