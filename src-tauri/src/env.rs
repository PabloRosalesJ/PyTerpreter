use crate::utils;
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct VenvInfo {
    pub path: String,
    pub name: String,
    pub python_version: String,
}

#[tauri::command]
pub fn create_venv(path: String) -> Result<String, String> {
    let venv_dir = Path::new(&path).join(".venv");
    if venv_dir.exists() {
        return Err("Virtual environment already exists at this path".to_string());
    }

    let uv = utils::find_uv()?;

    let output = std::process::Command::new(&uv)
        .args(["venv", ".venv"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run uv: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to create venv: {}", stderr));
    }

    Ok(venv_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_venvs(workspace_path: String) -> Result<Vec<VenvInfo>, String> {
    let mut venvs = Vec::new();
    let venv_dir = Path::new(&workspace_path).join(".venv");
    if venv_dir.exists() && venv_dir.join("pyvenv.cfg").exists() {
        let python_version = get_python_version(&venv_dir);
        let name = Path::new(&workspace_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        venvs.push(VenvInfo {
            path: venv_dir.to_string_lossy().to_string(),
            name: format!("{} (.venv)", name),
            python_version,
        });
    }
    Ok(venvs)
}

#[tauri::command]
pub fn get_current_venv(workspace_path: String) -> Result<Option<String>, String> {
    let venv_dir = Path::new(&workspace_path).join(".venv");
    if venv_dir.exists() && venv_dir.join("pyvenv.cfg").exists() {
        Ok(Some(venv_dir.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

fn get_python_version(venv_dir: &Path) -> String {
    let python = if cfg!(target_os = "windows") {
        venv_dir.join("Scripts/python.exe")
    } else {
        venv_dir.join("bin/python3")
    };
    if python.exists() {
        let output = std::process::Command::new(&python)
            .args(["--version"])
            .output()
            .ok();
        if let Some(out) = output {
            return String::from_utf8_lossy(&out.stdout).trim().to_string();
        }
    }
    "unknown".to_string()
}
