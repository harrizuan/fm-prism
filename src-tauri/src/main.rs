#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use fm_prism::commands::{self, AppState};

fn main() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    ).init();

    // CLI test mode: run with --test to test FM connection without GUI
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--test") {
        commands::cli_test();
        return;
    }

    log::info!("FM Prism starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::connect_to_fm,
            commands::disconnect_fm,
            commands::get_connection_status,
            commands::scan_for_players,
            commands::get_players,
            commands::get_player_count,
            commands::export_csv,
            commands::export_json,
            commands::search_players,
            commands::get_manager_profile,
            commands::get_squad_ids,
            commands::get_my_squad,
            commands::get_listed_players,
            commands::get_free_agents,
            commands::write_file,
            commands::get_youth_teams,
            commands::get_staff_data,
            commands::get_club_facilities,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
