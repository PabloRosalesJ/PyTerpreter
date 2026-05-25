use std::path::Path;
use std::process::Command;

pub fn find_uv() -> Result<String, String> {
    let output = Command::new("which")
        .arg("uv")
        .output()
        .map_err(|_| "which command failed".to_string())?;
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if !path.is_empty() && Path::new(&path).exists() {
        return Ok(path);
    }

    let home = std::env::var("HOME").unwrap_or_default();
    for candidate in &[
        "/usr/local/bin/uv",
        "/opt/homebrew/bin/uv",
        "/home/linuxbrew/.linuxbrew/bin/uv",
        &(home.clone() + "/.local/bin/uv"),
        &(home + "/.cargo/bin/uv"),
    ] {
        if Path::new(candidate).exists() {
            return Ok(candidate.to_string());
        }
    }

    Err("uv not found. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh".to_string())
}
