declare namespace monaco {
  type MarkerSeverity = 1 | 2 | 4 | 8;

  const MarkerSeverity: {
    Hint: 1;
    Info: 2;
    Warning: 4;
    Error: 8;
  };

  namespace editor {
    interface IStandaloneCodeEditor {
      setModel(model: ITextModel): void;
      getValue(): string;
      getModel(): ITextModel | null;
      focus(): void;
      layout(): void;
      dispose(): void;
      onDidChangeModelContent(cb: () => void): IDisposable;
      getAction(id: string): IEditorAction | null;
      addAction(descriptor: IActionDescriptor): IDisposable;
      executeCommand(source: string | null, command: ICommand): void;
      trigger(key: string | null, handlerId: string, payload?: unknown): void;
    }
    interface ITextModel {
      getValue(): string;
      setValue(value: string): void;
      dispose(): void;
      onDidChangeContent(cb: () => void): IDisposable;
      getLanguageId(): string;
      getWordUntilPosition(position: languages.IPosition): IWordAtPosition;
    }
    interface IDisposable {
      dispose(): void;
    }
    interface IEditorAction {
      isSupported(): boolean;
      run(): Promise<void>;
    }
    interface IActionDescriptor {
      id: string;
      label: string;
      keybindings?: number[];
      run(editor: IStandaloneCodeEditor, ...args: unknown[]): void;
    }
    interface ICommand {
      getEditOperations(model: ITextModel, builder: IEditOperationBuilder): void;
      computeCursorState(model: ITextModel, helper: ICursorStateComputerData): Selection;
    }
    interface IEditOperationBuilder {}
    interface ICursorStateComputerData {}
    class Selection {}
    type BuiltinTheme = "vs" | "vs-dark" | "hc-black";
    interface IStandaloneEditorConstructionOptions {
      value?: string;
      language?: string;
      theme?: BuiltinTheme;
      fontSize?: number;
      fontFamily?: string;
      lineNumbers?: "on" | "off" | "relative" | "interval";
      minimap?: { enabled: boolean };
      automaticLayout?: boolean;
      scrollBeyondLastLine?: boolean;
      tabSize?: number;
      insertSpaces?: boolean;
      renderWhitespace?: "none" | "boundary" | "selection" | "trailing" | "all";
      bracketPairColorization?: { enabled: boolean };
      padding?: { top: number };
      suggestOnTriggerCharacters?: boolean;
      quickSuggestions?: boolean;
      wordBasedSuggestions?: "off" | "currentDocument" | "matchingDocuments" | "allDocuments";
      parameterHints?: { enabled: boolean };
      autoClosingQuotes?: "always" | "beforeWhitespace" | "never";
      autoClosingBrackets?: "always" | "beforeWhitespace" | "never" | "languageDefined";
      formatOnPaste?: boolean;
    }
    function create(domElement: HTMLElement, options?: IStandaloneEditorConstructionOptions): IStandaloneCodeEditor;
    function createModel(value: string, language?: string, uri?: unknown): ITextModel;
    function setTheme(theme: BuiltinTheme): void;
    function defineTheme(name: string, themeData: IStandaloneThemeData): void;
    function setModelMarkers(model: ITextModel, owner: string, markers: IMarkerData[]): void;
    interface IStandaloneThemeData {
      base: BuiltinTheme;
      inherit: boolean;
      rules: ITokenThemeRule[];
      encodedTokensColors?: string[];
      colors: Record<string, string>;
    }
    interface ITokenThemeRule {
      token: string;
      foreground?: string;
      background?: string;
      fontStyle?: string;
    }
    interface IMarkerData {
      severity: MarkerSeverity;
      message: string;
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
      code?: string;
      source?: string;
    }
  }
  namespace languages {
    interface ILanguageExtensionPoint {
      id: string;
      extensions?: string[];
      filenames?: string[];
      aliases?: string[];
    }
    function register(language: ILanguageExtensionPoint): void;
    function setMonarchTokensProvider(languageId: string, languageDef: unknown): IDisposable;
    function registerCompletionItemProvider(languageId: string, provider: CompletionItemProvider): IDisposable;
    interface CompletionItemProvider {
      triggerCharacters?: string[];
      provideCompletionItems(
        model: editor.ITextModel,
        position: IPosition,
        context: CompletionContext,
        token: CancellationToken,
      ): CompletionList | Promise<CompletionList>;
    }
    interface CompletionContext {
      triggerKind: CompletionTriggerKind;
      triggerCharacter?: string;
    }
    type CompletionTriggerKind = 0 | 1 | 2 | 3;
    interface CompletionList {
      suggestions: CompletionItem[];
      incomplete?: boolean;
    }
    interface CompletionItem {
      label: string | CompletionItemLabel;
      kind?: number;
      tags?: number[];
      detail?: string;
      documentation?: string | IMarkdownString;
      sortText?: string;
      filterText?: string;
      preselect?: boolean;
      insertText: string;
      insertTextRules?: number;
      range?: IRange | { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number };
      commitCharacters?: string[];
      additionalTextEdits?: unknown[];
    }
    interface CompletionItemLabel {
      label: string;
      description?: string;
    }
    interface IMarkdownString {
      value: string;
      isTrusted?: boolean;
      supportThemeIcons?: boolean;
    }
    const CompletionItemKind: {
      Text: 0;
      Method: 1;
      Function: 2;
      Constructor: 3;
      Field: 4;
      Variable: 5;
      Class: 6;
      Interface: 7;
      Module: 8;
      Property: 9;
      Unit: 10;
      Value: 11;
      Enum: 12;
      Keyword: 13;
      Snippet: 14;
      Color: 15;
      File: 16;
      Reference: 17;
      Folder: 18;
      EnumMember: 19;
      Constant: 20;
      Struct: 21;
      Event: 22;
      Operator: 23;
      TypeParameter: 24;
      User: 25;
      Issue: 26;
    };
    const CompletionItemInsertTextRule: {
      KeepWhitespace: 1;
      InsertAsSnippet: 4;
    };
    interface IPosition {
      lineNumber: number;
      column: number;
    }
    interface IRange {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    }
    interface CancellationToken {
      isCancellationRequested: boolean;
      onCancellationRequested: (cb: () => void) => IDisposable;
    }
  }
  namespace editor {
    interface IWordAtPosition {
      word: string;
      startColumn: number;
      endColumn: number;
    }
    function getWordAtPosition(model: ITextModel, position: languages.IPosition): IWordAtPosition | null;
  }
}

interface Window {
  __monacoReady: boolean;
  __monaco: typeof monaco;
  __monacoLoading: boolean;
}
