mod runner;
mod env;
mod pkg;
mod linter;
mod utils;

use std::sync::Mutex;

use runner::run_script;
use env::{create_venv, list_venvs, get_current_venv};
use pkg::{install_pkg, list_pkgs};
use linter::lint_code;

struct AppState {
    workspace: Mutex<Option<String>>,
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().extension().map(|e| e == "py").unwrap_or(false) {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
fn get_uv_path() -> Result<String, String> {
    utils::find_uv()
}

#[tauri::command]
fn set_workspace(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let mut ws = state.workspace.lock().map_err(|e| e.to_string())?;
    *ws = Some(path);
    Ok(())
}

#[tauri::command]
fn get_workspace(state: tauri::State<AppState>) -> Result<Option<String>, String> {
    let ws = state.workspace.lock().map_err(|e| e.to_string())?;
    Ok(ws.clone())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            workspace: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            run_script,
            lint_code,
            create_venv,
            list_venvs,
            get_current_venv,
            install_pkg,
            list_pkgs,
            save_file,
            load_file,
            list_dir,
            get_uv_path,
            set_workspace,
            get_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
