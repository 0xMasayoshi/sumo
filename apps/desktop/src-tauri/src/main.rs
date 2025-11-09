use std::process::{Command, Stdio};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

#[cfg(target_os = "macos")]
const BIN: &str = "bin/darwin/sumo-daemon";
#[cfg(target_os = "linux")]
const BIN: &str = "bin/linux/sumo-daemon";
#[cfg(target_os = "windows")]
const BIN: &str = "bin/win32/sumo-daemon.exe";

fn start_daemon() -> std::io::Result<()> {
  Command::new(BIN)
    .args(["--port", "5040", "--profile", ".sumo"])
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()?;
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      // ----- Native menu (Tauri v2) -----
      let about = MenuItem::with_id(app, "about_sumo", "About Sumo", true, None::<&str>)?;

      let sumo_submenu = Submenu::with_items(
        app,
        "Sumo",
        true,
        &[
          &about,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::quit(app, None)?,
        ],
      )?;

      let edit_submenu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
          &PredefinedMenuItem::undo(app, None)?,
          &PredefinedMenuItem::redo(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::cut(app, None)?,
          &PredefinedMenuItem::copy(app, None)?,
          &PredefinedMenuItem::paste(app, None)?,
          &PredefinedMenuItem::select_all(app, None)?,
        ],
      )?;

      let menu = Menu::with_items(app, &[&sumo_submenu, &edit_submenu])?;
      app.set_menu(menu)?;

      // ----- Launch daemon -----
      start_daemon().expect("start daemon");
      Ok(())
    })
    .on_menu_event(|_app, ev| {
      match ev.id().as_ref() {
        "about_sumo" => {
          // TODO: open an about dialog/route
          println!("About Sumo clicked");
        }
        _ => {}
      }
    })
    .run(tauri::generate_context!())
    .expect("tauri run error");
}
