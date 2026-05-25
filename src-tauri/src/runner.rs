use crate::utils;
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct RunResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub fn run_script(code: String, venv: Option<String>) -> Result<RunResult, String> {
    let tmp_dir = std::env::temp_dir().join("pyterpreter");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    let script_path = tmp_dir.join("script.py");
    std::fs::write(&script_path, &code).map_err(|e| e.to_string())?;

    let output = if let Some(venv_path) = venv {
        let python = if cfg!(target_os = "windows") {
            std::path::Path::new(&venv_path).join("Scripts/python.exe")
        } else {
            std::path::Path::new(&venv_path).join("bin/python3")
        };
        if !python.exists() {
            return Err(format!(
                "Python not found at {:?}. The venv may be corrupted.",
                python
            ));
        }
        Command::new(&python)
            .arg(script_path.to_str().unwrap_or("script.py"))
            .output()
            .map_err(|e| format!("Failed to execute python: {}", e))?
    } else {
        let uv = utils::find_uv();
        if let Ok(uv_path) = uv {
            Command::new(&uv_path)
                .args(["run", "python3"])
                .arg(script_path.to_str().unwrap_or("script.py"))
                .output()
                .map_err(|e| format!("Failed to execute uv: {}", e))?
        } else {
            Command::new("python3")
                .arg(script_path.to_str().unwrap_or("script.py"))
                .output()
                .map_err(|e| format!("Failed to execute python3: {}", e))?
        }
    };

    Ok(RunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
