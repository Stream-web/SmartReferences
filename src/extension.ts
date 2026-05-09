import * as path from 'path';
import * as vscode from 'vscode';

type MatchItem = {
  uri: vscode.Uri;
  line: number;
  preview: string;
  pattern: string;
};

const SEARCH_GLOB = '**/*.{js,jsx,ts,tsx,vue,json}';
const EXCLUDE_GLOB = '**/{node_modules,dist,coverage,.git}/**';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'vueSmartReferences.findCurrentFileReferences',
    async (uri?: vscode.Uri) => {
      // 支持从资源管理器右键调用
      let targetUri: vscode.Uri | undefined = uri;
      
      // 如果没有传入 uri，则使用当前编辑器的文件
      if (!targetUri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('请先打开一个文件再执行引用查找。');
          return;
        }
        targetUri = editor.document.uri;
      }
      if (targetUri.scheme !== 'file') {
        vscode.window.showWarningMessage('当前文件不在本地文件系统中，无法查找引用。');
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('当前文件不在工作区中，无法查找引用。');
        return;
      }

      const targetFsPath = normalizePath(targetUri.fsPath);
      const rootPath = normalizePath(workspaceFolder.uri.fsPath);
      const aliases = getAliasCandidates(rootPath);
      const patterns = buildPathPatterns(targetFsPath, rootPath, aliases);

      if (!patterns.length) {
        vscode.window.showWarningMessage('未能生成有效的引用检索模式。');
        return;
      }

      const files = await vscode.workspace.findFiles(SEARCH_GLOB, EXCLUDE_GLOB);
      const results: MatchItem[] = [];

      for (const fileUri of files) {
        if (normalizePath(fileUri.fsPath) === targetFsPath) {
          continue;
        }

        const doc = await vscode.workspace.openTextDocument(fileUri);
        const text = doc.getText();
        const lines = text.split(/\r?\n/);

        lines.forEach((lineText, idx) => {
          for (const p of patterns) {
            if (lineText.includes(p)) {
              results.push({
                uri: fileUri,
                line: idx,
                preview: lineText.trim(),
                pattern: p
              });
              break;
            }
          }
        });
      }

      if (!results.length) {
        vscode.window.showInformationMessage('没有找到匹配引用。');
        return;
      }

      const pickItems = results.map(item => ({
        label: path.relative(rootPath, item.uri.fsPath),
        description: `第 ${item.line + 1} 行 · 命中: ${item.pattern}`,
        detail: item.preview || '(空行)',
        item
      }));

      const picked = await vscode.window.showQuickPick(pickItems, {
        title: `找到 ${results.length} 条可能引用`,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!picked) {
        return;
      }

      const doc = await vscode.workspace.openTextDocument(picked.item.uri);
      const editorRef = await vscode.window.showTextDocument(doc, { preview: false });
      const pos = new vscode.Position(picked.item.line, 0);
      editorRef.selection = new vscode.Selection(pos, pos);
      editorRef.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function getAliasCandidates(rootPath: string): string[] {
  const srcPath = normalizePath(path.join(rootPath, 'src'));
  return ['@', '@/', srcPath, `${srcPath}/`];
}

function buildPathPatterns(targetPath: string, rootPath: string, aliases: string[]): string[] {
  const normalizedTarget = normalizePath(targetPath);
  const normalizedRoot = normalizePath(rootPath);
  const relativePath = normalizePath(path.relative(normalizedRoot, normalizedTarget));
  const relativeNoExt = relativePath.replace(/\.vue$/, '');
  const relativeNoIndex = relativeNoExt.replace(/\/index$/, '');
  const srcRelative = relativePath.startsWith('src/') ? relativePath.slice(4) : relativePath;
  const srcRelativeNoExt = srcRelative.replace(/\.vue$/, '');
  const srcRelativeNoIndex = srcRelativeNoExt.replace(/\/index$/, '');

  const set = new Set<string>();
  set.add(relativePath);
  set.add(relativeNoExt);
  set.add(relativeNoIndex);

  for (const alias of aliases) {
    const a = alias.endsWith('/') ? alias.slice(0, -1) : alias;
    set.add(`${a}/${srcRelative}`);
    set.add(`${a}/${srcRelativeNoExt}`);
    set.add(`${a}/${srcRelativeNoIndex}`);
  }

  return Array.from(set).filter(Boolean);
}
