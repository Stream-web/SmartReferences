# Vue Smart References

vscode 插件，直接把.vsix直接拖到VSCode/cursor插件里面即可，用于补充 VSCode/Cursor 在 Vue 项目中对“文件被引用位置”检索不完整的问题，尤其适配：

- `@/xxx` 别名路径引用
- 省略 `.vue` 后缀的引用
- 省略 `/index` 的目录引用
- `import()`、`require()` 等字符串路径引用

## 使用方式

1. 打开本目录并安装依赖：

```bash
npm install
```

2. 编译：

```bash
npm run compile
```

3. 打包 VSIX：

```bash
npm install
npm run package:vsix
```

如果直接运行 `npx @vscode/vsce package`，`npx` 可能会拉取最新 `vsce`。在较老的 Node 版本下，这会触发 `tracingChannel is not a function` 之类的错误。仓库里已经固定了一个兼容性更稳的 `vsce` 版本，优先使用 `npm run package:vsix`。

4. 在 VSCode/Cursor 中启动扩展开发宿主（F5）。
5. 在宿主窗口中打开你的业务仓库，定位到任意 `.vue` 文件（例如 `src/components/workbench-top/index.vue`）。
6. 执行命令：
   - `Vue Smart References: Find References for Current File`
7. 插件会弹出候选引用列表，点击后自动跳转到对应文件和行。

## 已知限制

- 当前以“字符串命中”为主，不做完整 AST 语义分析。
- 对全局自动注册组件（无显式路径）场景，无法 100% 准确定位。
- 大仓库首次扫描速度取决于文件数量。
