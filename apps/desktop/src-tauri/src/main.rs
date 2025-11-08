use std::process::{Command, Stdio};

#[cfg(target_os="macos")]  const BIN: &str = "bin/darwin/sumo-daemon";
#[cfg(target_os="linux")]  const BIN: &str = "bin/linux/sumo-daemon";
#[cfg(target_os="windows")]const BIN: &str = "bin/win32/sumo-daemon.exe";

fn start_daemon() -> std::io::Result<()> {
  Command::new(BIN)
    .args(["--port","5040","--profile",".sumo"])
    .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
    .spawn()?;
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .setup(|_app| { start_daemon().expect("start daemon"); Ok(()) })
    .run(tauri::generate_context!())
    .expect("tauri run error");
}
