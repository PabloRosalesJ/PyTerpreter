use crate::utils;
use serde::Serialize;

#[derive(Serialize)]
pub struct PkgInfo {
    pub name: String,
    pub version: String,
}

fn venv_python(venv_path: &str) -> std::path::PathBuf {
    let venv_dir = std::path::Path::new(venv_path);
    if cfg!(target_os = "windows") {
        venv_dir.join("Scripts/python.exe")
    } else {
        venv_dir.join("bin/python3")
    }
}

#[tauri::command]
pub fn install_pkg(venv_path: String, pkg_name: String) -> Result<String, String> {
    let uv = utils::find_uv()?;
    let python = venv_python(&venv_path);

    if !python.exists() {
        return Err(format!("Python not found at {:?}. Is the venv valid?", python));
    }

    let output = std::process::Command::new(&uv)
        .args(["pip", "install", "--python", &python.to_string_lossy(), &pkg_name])
        .output()
        .map_err(|e| format!("Failed to run uv pip: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!("Install failed:\n{}", stderr));
    }

    Ok(stdout)
}

#[tauri::command]
pub fn list_pkgs(venv_path: String) -> Result<Vec<PkgInfo>, String> {
    let uv = utils::find_uv()?;
    let python = venv_python(&venv_path);

    if !python.exists() {
        return Err(format!("Python not found at {:?}. Is the venv valid?", python));
    }

    let output = std::process::Command::new(&uv)
        .args(["pip", "list", "--python", &python.to_string_lossy(), "--format=json"])
        .output()
        .map_err(|e| format!("Failed to list packages: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to list packages: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let packages: Vec<serde_json::Value> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse uv pip list: {}", e))?;

    Ok(packages
        .iter()
        .map(|p| PkgInfo {
            name: p["name"].as_str().unwrap_or("unknown").to_string(),
            version: p["version"].as_str().unwrap_or("unknown").to_string(),
        })
        .collect())
}
