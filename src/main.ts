import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

interface Tab {
  id: string;
  name: string;
  path: string | null;
  model: monaco.editor.ITextModel;
  dirty: boolean;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

interface VenvInfo {
  path: string;
  name: string;
  python_version: string;
}

interface LintDiag {
  line: number;
  col: number;
  message: string;
  severity: string;
}

let editor: monaco.editor.IStandaloneCodeEditor;
let monaco: typeof window.__monaco;
let tabs: Tab[] = [];
let activeTabId: string | null = null;
let tabCounter = 0;
let isDarkTheme = true;
let lintTimer: ReturnType<typeof setTimeout> | null = null;

// ── Monaco init ────────────────────────────────────────

function waitForMonaco(): Promise<typeof window.__monaco> {
  return new Promise((resolve) => {
    if (window.__monacoReady) {
      resolve(window.__monaco);
    } else {
      document.addEventListener("monaco-ready", () => resolve(window.__monaco));
    }
  });
}

// ── Tab Management ─────────────────────────────────────

function createTabId(): string {
  return `tab-${++tabCounter}`;
}

function addTab(name?: string, filePath?: string | null, content?: string) {
  const tabName = name || `scratch_${tabCounter + 1}.py`;
  const model = content
    ? monaco.editor.createModel(content, "python")
    : monaco.editor.createModel('print("Hello, PyTerpreter!")\n', "python");

  const tab: Tab = {
    id: createTabId(),
    name: tabName,
    path: filePath || null,
    model,
    dirty: false,
  };

  tabs.push(tab);
  renderTabs();
  switchToTab(tab.id);

  tab.model.onDidChangeContent(() => {
    tab.dirty = true;
    renderTabs();
    debounceLint(tab.model);
  });
}

function switchToTab(tabId: string) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  activeTabId = tabId;
  editor.setModel(tab.model);
  renderTabs();
}

function closeTab(tabId: string) {
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;

  const tab = tabs[idx]!;
  tab.model.dispose();
  tabs.splice(idx, 1);
  renderTabs();

  if (activeTabId === tabId) {
    const newIdx = Math.min(idx, tabs.length - 1);
    switchToTab(tabs[newIdx]!.id);
  }
}

function getActiveTab(): Tab | undefined {
  return tabs.find((t) => t.id === activeTabId);
}

function renderTabs() {
  const container = document.getElementById("tabs-container")!;
  container.innerHTML = "";

  for (const tab of tabs) {
    const el = document.createElement("div");
    el.className = `tab${tab.id === activeTabId ? " active" : ""}`;

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = tab.dirty ? `${tab.name} ●` : tab.name;
    el.appendChild(name);

    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "×";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(close);

    el.addEventListener("click", () => switchToTab(tab.id));
    container.appendChild(el);
  }
}

// ── Output ─────────────────────────────────────────────

function getOutputEl(): HTMLPreElement {
  return document.getElementById("output-content") as HTMLPreElement;
}

function appendOutput(text: string, className?: string) {
  const el = getOutputEl();
  if (el.textContent === "Ready. Press ▶ Run or Cmd+Enter to execute.") {
    el.textContent = "";
  }
  const line = document.createElement("div");
  line.textContent = text;
  if (className) line.className = className;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function clearOutput() {
  const el = getOutputEl();
  el.innerHTML = `<span class="dim">Ready. Press ▶ Run or Cmd+Enter to execute.</span>`;
}

// ── Linting ────────────────────────────────────────────

async function lintModel(model: monaco.editor.ITextModel) {
  const code = model.getValue();
  if (!code.trim()) {
    monaco.editor.setModelMarkers(model, "python", []);
    return;
  }

  try {
    const diags = await invoke<LintDiag[]>("lint_code", { code });
    const markers: monaco.editor.IMarkerData[] = diags
      .filter((d) => d.line > 0)
      .map((d) => ({
        severity:
          d.severity === "error"
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
        message: d.message,
        startLineNumber: d.line,
        startColumn: Math.max(1, d.col),
        endLineNumber: d.line,
        endColumn: 999,
      }));
    monaco.editor.setModelMarkers(model, "python", markers);
  } catch {
    // lint errors are non-critical; don't spam user
  }
}

function debounceLint(model: monaco.editor.ITextModel) {
  if (lintTimer) clearTimeout(lintTimer);
  lintTimer = setTimeout(() => lintModel(model), 500);
}

// ── Python Completion Provider ─────────────────────────

const PY_KEYWORDS = [
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
];

const PY_BUILTINS = [
  "abs", "all", "any", "bin", "bool", "bytearray", "bytes", "callable",
  "chr", "classmethod", "compile", "complex", "delattr", "dict", "dir",
  "divmod", "enumerate", "eval", "exec", "filter", "float", "format",
  "frozenset", "getattr", "globals", "hasattr", "hash", "help", "hex",
  "id", "input", "int", "isinstance", "issubclass", "iter", "len",
  "list", "locals", "map", "max", "memoryview", "min", "next",
  "object", "oct", "open", "ord", "pow", "print", "property", "range",
  "repr", "reversed", "round", "set", "setattr", "slice", "sorted",
  "staticmethod", "str", "sum", "super", "tuple", "type", "vars",
  "zip", "__import__",
];

const PY_STDLIB_MODULES = [
  "os", "sys", "json", "re", "math", "datetime", "pathlib", "collections",
  "itertools", "functools", "random", "string", "typing", "enum",
  "decimal", "hashlib", "base64", "copy", "csv", "abc", "time",
  "statistics", "uuid", "glob", "shutil", "tempfile", "socket",
  "subprocess", "threading", "multiprocessing", "asyncio",
  "xml", "html", "http", "urllib", "email", "sqlite3", "configparser",
  "argparse", "logging", "unittest", "doctest", "pdb", "traceback",
  "warnings", "dataclasses", "pprint",
];

function registerPythonCompletion() {
  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: [".", "(", " "],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = [
        ...PY_KEYWORDS.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword as number,
          insertText: kw,
          range,
        })),
        ...PY_BUILTINS.map((fn) => ({
          label: `${fn}()`,
          kind: monaco.languages.CompletionItemKind.Function as number,
          insertText: fn,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
          range,
        })),
        ...PY_STDLIB_MODULES.map((mod) => ({
          label: mod,
          kind: monaco.languages.CompletionItemKind.Module as number,
          insertText: mod,
          range,
        })),
      ];

      return { suggestions };
    },
  });
}

// ── Run Script ─────────────────────────────────────────

async function runScript() {
  const tab = getActiveTab();
  if (!tab) return;

  const code = tab.model.getValue();
  const venvSelect = document.getElementById("venv-select") as HTMLSelectElement;
  const venvPath = venvSelect.value || null;

  appendOutput(`$ python3 ${tab.name}`, "dim");

  try {
    const result = await invoke<RunResult>("run_script", {
      code,
      venv: venvPath,
    });

    if (result.stdout) appendOutput(result.stdout);
    if (result.stderr) appendOutput(result.stderr, "stderr");

    if (result.exit_code === 0) {
      appendOutput(`\n[Process exited with code ${result.exit_code}]`, "success");
    } else {
      appendOutput(`\n[Process exited with code ${result.exit_code}]`, "stderr");
    }
  } catch (err) {
    appendOutput(`Error: ${err}`, "stderr");
  }
}

// ── File Operations ────────────────────────────────────

async function openFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Python", extensions: ["py"] }],
    });
    if (!selected) return;

    const filePath = selected as string;
    const content = await invoke<string>("load_file", { path: filePath });
    const name = filePath.split("/").pop() || "untitled.py";
    addTab(name, filePath, content);
  } catch (err) {
    appendOutput(`Error opening file: ${err}`, "stderr");
  }
}

async function saveFile() {
  const tab = getActiveTab();
  if (!tab) return;

  let filePath = tab.path;

  if (!filePath) {
    const selected = await save({
      filters: [{ name: "Python", extensions: ["py"] }],
      defaultPath: tab.name,
    });
    if (!selected) return;
    filePath = selected as string;
  }

  try {
    await invoke("save_file", {
      path: filePath,
      content: tab.model.getValue(),
    });
    tab.path = filePath;
    tab.name = filePath.split("/").pop() || tab.name;
    tab.dirty = false;
    renderTabs();
    appendOutput(`Saved ${filePath}`, "success");
  } catch (err) {
    appendOutput(`Error saving: ${err}`, "stderr");
  }
}

// ── Workspace ──────────────────────────────────────────

async function pickWorkspace() {
  try {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (!selected) return;

    const wsPath = selected as string;
    await invoke("set_workspace", { path: wsPath });
    updateWorkspaceDisplay(wsPath);
    appendOutput(`Workspace set to ${wsPath}`, "success");

    const existing = await invoke<VenvInfo[]>("list_venvs", {
      workspacePath: wsPath,
    });
    const select = document.getElementById("venv-select") as HTMLSelectElement;
    select.innerHTML = '<option value="">No venv (uv run)</option>';
    for (const venv of existing) {
      const opt = document.createElement("option");
      opt.value = venv.path;
      opt.textContent = `${venv.name} (${venv.python_version})`;
      select.appendChild(opt);
    }
  } catch (err) {
    appendOutput(`Error: ${err}`, "stderr");
  }
}

function updateWorkspaceDisplay(path: string) {
  const el = document.getElementById("workspace-label")!;
  const name = path.split("/").pop() || path;
  el.textContent = `📂 ${name}`;
  el.title = path;
}

// ── Virtual Environment ────────────────────────────────

async function createVenv() {
  try {
    const ws = await invoke<string | null>("get_workspace");
    if (!ws) {
      appendOutput("❌ No workspace selected. Click 📂 Set Workspace first.", "stderr");
      return;
    }

    appendOutput("Creating virtual environment...", "dim");
    const result = await invoke<string>("create_venv", { path: ws });
    appendOutput(`Created venv: ${result}`, "success");

    const existing = await invoke<VenvInfo[]>("list_venvs", {
      workspacePath: ws,
    });
    const select = document.getElementById("venv-select") as HTMLSelectElement;
    select.innerHTML = '<option value="">No venv (uv run)</option>';
    for (const venv of existing) {
      const opt = document.createElement("option");
      opt.value = venv.path;
      opt.textContent = `${venv.name} (${venv.python_version})`;
      select.appendChild(opt);
    }
    if (select.options.length > 1) select.selectedIndex = 1;
  } catch (err) {
    appendOutput(`Error: ${err}`, "stderr");
  }
}

// ── Package Management ─────────────────────────────────

let pkgModalVisible = false;

function showPkgModal() {
  pkgModalVisible = true;
  document.getElementById("pkg-modal-overlay")!.classList.remove("hidden");
  document.getElementById("pkg-input")!.focus();
}

function hidePkgModal() {
  pkgModalVisible = false;
  document.getElementById("pkg-modal-overlay")!.classList.add("hidden");
  document.getElementById("modal-result")!.textContent = "";
}

async function installPkg() {
  const input = document.getElementById("pkg-input") as HTMLInputElement;
  const raw = input.value.trim();
  if (!raw) return;

  const resultEl = document.getElementById("modal-result")!;
  const venvSelect = document.getElementById("venv-select") as HTMLSelectElement;
  const venvPath = venvSelect.value;

  if (!venvPath) {
    resultEl.textContent = "❌ No virtual environment selected. Create one first.";
    return;
  }

  resultEl.textContent = `Installing ${raw}...`;

  try {
    const result = await invoke<string>("install_pkg", {
      venvPath,
      pkgName: raw,
    });
    resultEl.textContent = `✅ ${result}`;
    input.value = "";
  } catch (err) {
    resultEl.textContent = `❌ ${err}`;
  }
}

// ── Theme ──────────────────────────────────────────────

function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  document.documentElement.classList.toggle("light", !isDarkTheme);
  const icon = document.getElementById("theme-icon")!;
  icon.textContent = isDarkTheme ? "🌙" : "☀️";
  monaco.editor.setTheme(isDarkTheme ? "vs-dark" : "vs");
}

// ── Divider Drag ───────────────────────────────────────

function initDivider() {
  const divider = document.getElementById("divider")!;
  const outputPane = document.getElementById("output-pane")!;
  let isDragging = false;

  divider.addEventListener("mousedown", () => {
    isDragging = true;
    divider.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (ev) => {
    if (!isDragging) return;
    const container = document.getElementById("main-container")!;
    const rect = container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const outputWidth = Math.max(200, Math.min(800, rect.width - x - 5));
    outputPane.style.width = `${outputWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      divider.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

// ── Keyboard Shortcuts ─────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const isCmd = e.metaKey || e.ctrlKey;

    if (isCmd && e.key === "Enter") {
      e.preventDefault();
      runScript();
    }

    if (isCmd && e.key === "s") {
      e.preventDefault();
      saveFile();
    }

    if (isCmd && e.key === "n") {
      e.preventDefault();
      addTab();
    }

    if (isCmd && e.key === "w") {
      e.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    }

    if (isCmd && e.key === "o") {
      e.preventDefault();
      openFile();
    }

    if (e.key === "Escape" && pkgModalVisible) {
      hidePkgModal();
    }
  });
}

// ── Init Editor ────────────────────────────────────────

function initEditor() {
  editor = monaco.editor.create(document.getElementById("editor-container")!, {
    value: 'print("Hello, PyTerpreter!")\n',
    language: "python",
    theme: "vs-dark",
    fontSize: 14,
    fontFamily:
      "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
    lineNumbers: "on",
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    tabSize: 4,
    insertSpaces: true,
    renderWhitespace: "selection",
    bracketPairColorization: { enabled: true },
    padding: { top: 8 },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    wordBasedSuggestions: "currentDocument",
    parameterHints: { enabled: true },
    autoClosingQuotes: "always",
    autoClosingBrackets: "always",
    formatOnPaste: true,
  });
}

// ── Main ───────────────────────────────────────────────

async function main() {
  monaco = await waitForMonaco();
  initEditor();
  registerPythonCompletion();

  addTab("main.py");

  initDivider();
  initKeyboardShortcuts();

  document.getElementById("btn-run")!.addEventListener("click", runScript);
  document.getElementById("btn-new-tab")!.addEventListener("click", () => addTab());
  document.getElementById("btn-open")!.addEventListener("click", openFile);
  document.getElementById("btn-save")!.addEventListener("click", saveFile);
  document.getElementById("btn-set-workspace")!.addEventListener("click", pickWorkspace);
  document.getElementById("btn-new-env")!.addEventListener("click", createVenv);
  document.getElementById("btn-install-pkg")!.addEventListener("click", showPkgModal);
  document.getElementById("btn-clear-output")!.addEventListener("click", clearOutput);
  document.getElementById("btn-clear-output-small")!.addEventListener("click", clearOutput);
  document.getElementById("btn-theme")!.addEventListener("click", toggleTheme);

  document.getElementById("modal-close")!.addEventListener("click", hidePkgModal);
  document.getElementById("modal-install")!.addEventListener("click", installPkg);
  document.getElementById("pkg-modal-overlay")!.addEventListener("click", (ev) => {
    if (ev.target === ev.currentTarget) hidePkgModal();
  });
  document.getElementById("pkg-input")!.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") installPkg();
  });

  const savedWs = await invoke<string | null>("get_workspace");
  if (savedWs) {
    updateWorkspaceDisplay(savedWs);
    const existing = await invoke<VenvInfo[]>("list_venvs", {
      workspacePath: savedWs,
    });
    const select = document.getElementById("venv-select") as HTMLSelectElement;
    for (const venv of existing) {
      const opt = document.createElement("option");
      opt.value = venv.path;
      opt.textContent = `${venv.name} (${venv.python_version})`;
      select.appendChild(opt);
    }
  }
}

document.addEventListener("DOMContentLoaded", main);
