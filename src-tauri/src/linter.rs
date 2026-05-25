use serde::Serialize;
use std::process::Command;

#[derive(Serialize, serde::Deserialize)]
pub struct LintDiag {
    pub line: usize,
    pub col: usize,
    pub message: String,
    pub severity: String,
}

#[tauri::command]
pub fn lint_code(code: String) -> Result<Vec<LintDiag>, String> {
    let tmp_dir = std::env::temp_dir().join("pyterpreter");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    let script_path = tmp_dir.join("_lint_.py");
    std::fs::write(&script_path, &code).map_err(|e| e.to_string())?;

    let script = format!(
        r#"import ast, sys, json
try:
    with open(sys.argv[1]) as f:
        ast.parse(f.read(), filename=sys.argv[1])
    print(json.dumps([]))
except SyntaxError as e:
    print(json.dumps([{{
        "line": e.lineno or 0,
        "col": e.offset or 0,
        "message": e.msg,
        "severity": "error"
    }}]))
except Exception as e:
    print(json.dumps([{{
        "line": 0,
        "col": 0,
        "message": str(e),
        "severity": "error"
    }}]))
"#
    );

    let check_path = tmp_dir.join("_check_syntax_.py");
    std::fs::write(&check_path, &script).map_err(|e| e.to_string())?;

    let output = Command::new("python3")
        .arg(&check_path)
        .arg(&script_path)
        .output()
        .map_err(|e| format!("Failed to run syntax check: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Syntax check failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let diags: Vec<LintDiag> =
        serde_json::from_str(stdout.trim()).map_err(|e| format!("Failed to parse lint output: {}", e))?;

    Ok(diags)
}
