# PyTerpreter

A Tinkerwell/RunJS-like Python playground built with Tauri v2 and Monaco Editor.

Write and run Python scripts in a native desktop app with full editor support, virtual environments, and package management.

![screenshot](public/vite.svg)

## Features

- **Monaco Editor** — full VS Code-grade editor with syntax highlighting, autocompletion for Python keywords/builtins/stdlib, bracket pair colorization, and more
- **Run scripts locally** — executes Python via `uv run` or inside a virtual environment
- **Tab-based interface** — multiple scripts open simultaneously
- **Virtual environment management** — create, select, and use `venv`s with `uv`
- **Package installation** — install PyPI packages into the active venv
- **File operations** — open and save `.py` files from your system
- **Workspace support** — set a workspace directory; PyTerpreter remembers it
- **Live linting** — Python syntax and error checking via the backend
- **Dark/Light theme** — toggle between VS Dark and Light themes
- **Resizable panes** — drag the divider between editor and output
- **Keyboard shortcuts** — `Cmd+Enter` to run, `Cmd+S` to save, `Cmd+N` new tab, `Cmd+O` open, `Cmd+W` close tab

## Requirements

- [uv](https://docs.astral.sh/uv/) (fast Python package installer and resolver) — PyTerpreter uses `uv` to run scripts, create venvs, and install packages
- Python 3.x (via `uv`)

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

The binary is output at `src-tauri/target/release/pyterpreter` (macOS/Linux) or `src-tauri/target/release/pyterpreter.exe` (Windows). Installers are placed in `src-tauri/target/release/bundle/` (`.dmg` on macOS, `.msi` on Windows, `.deb`/`.AppImage` on Linux).

## License

MIT — see [LICENSE](LICENSE).

You are free to reuse, modify, and distribute this project, including parts of its code, as long as you retain the copyright notice and permission notice (attribution). In other words: if you use code from PyTerpreter, you must credit this repository and include the license notice.

## Tech Stack

- **Frontend:** TypeScript, Vite, Monaco Editor
- **Backend:** Rust, Tauri v2
- **Python runner:** uv
