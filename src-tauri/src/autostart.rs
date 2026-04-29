use std::path::PathBuf;

fn exe_path() -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|e| e.to_string())
}

pub fn enable() -> Result<(), String> {
    let exe = exe_path()?;
    platform::enable(exe)
}

pub fn disable() -> Result<(), String> {
    platform::disable()
}

pub fn is_enabled() -> bool {
    platform::is_enabled()
}

#[cfg(target_os = "linux")]
mod platform {
    use std::path::PathBuf;

    fn desktop_path() -> PathBuf {
        let config = std::env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| {
            format!(
                "{}/.config",
                std::env::var("HOME").unwrap_or_default()
            )
        });
        PathBuf::from(config).join("autostart").join("passwordvault.desktop")
    }

    pub fn enable(exe: PathBuf) -> Result<(), String> {
        let path = desktop_path();
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        let content = format!(
            "[Desktop Entry]\nType=Application\nName=PasswordVault\nExec={exe}\nHidden=false\nNoDisplay=false\nX-GNOME-Autostart-enabled=true\n",
            exe = exe.display()
        );
        std::fs::write(path, content).map_err(|e| e.to_string())
    }

    pub fn disable() -> Result<(), String> {
        let path = desktop_path();
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn is_enabled() -> bool {
        desktop_path().exists()
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::path::PathBuf;

    fn plist_path() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_default();
        PathBuf::from(home)
            .join("Library/LaunchAgents")
            .join("com.passwordvault.app.plist")
    }

    pub fn enable(exe: PathBuf) -> Result<(), String> {
        let path = plist_path();
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        let content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.passwordvault.app</string>
  <key>ProgramArguments</key><array><string>{exe}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
</dict></plist>"#,
            exe = exe.display()
        );
        std::fs::write(path, content).map_err(|e| e.to_string())
    }

    pub fn disable() -> Result<(), String> {
        let path = plist_path();
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn is_enabled() -> bool {
        plist_path().exists()
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::path::PathBuf;

    const REG_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APP_NAME: &str = "PasswordVault";

    pub fn enable(exe: PathBuf) -> Result<(), String> {
        let output = std::process::Command::new("reg")
            .args([
                "add",
                &format!("HKCU\\{REG_KEY}"),
                "/v", APP_NAME,
                "/t", "REG_SZ",
                "/d", &exe.to_string_lossy(),
                "/f",
            ])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).into_owned());
        }
        Ok(())
    }

    pub fn disable() -> Result<(), String> {
        let _ = std::process::Command::new("reg")
            .args(["delete", &format!("HKCU\\{REG_KEY}"), "/v", APP_NAME, "/f"])
            .output();
        Ok(())
    }

    pub fn is_enabled() -> bool {
        std::process::Command::new("reg")
            .args(["query", &format!("HKCU\\{REG_KEY}"), "/v", APP_NAME])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
