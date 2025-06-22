use adw::prelude::*;
use gtk::Application;
use glib::ControlFlow;
use log::info;
use std::rc::Rc;
use std::sync::{Arc, Mutex};

mod api;
mod ui;
mod utils;

static mut MAIN_WINDOW: Option<crate::ui::MainWindow> = None;

fn main() {
    // Initialize logging with debug level
    unsafe {
        std::env::set_var("RUST_LOG", "debug");
    }
    env_logger::init();
    info!("Starting Latke...");

    // Create GTK application
    let app = Rc::new(Application::builder()
        .application_id("com.github.latke")
        .build());

    // Set up application activation handler
    app.connect_activate(move |app| {
        info!("Application activated");
        
        // Create API client
        let client = Arc::new(Mutex::new(api::IBroadcastClient::new()));
        
        // Create and show login window
        let login_window = Rc::new(ui::LoginWindow::new(app.clone().as_ref(), client.clone()));
        let login_window_clone = login_window.clone();
        let app_clone = app.clone();
        login_window.connect_login({
            let login_window = login_window.clone();
            let app = app.clone();
            move || {
                info!("Login successful");
                // Fetch library and show main window in a background thread using a channel
                use std::sync::mpsc;
                let (tx, rx) = mpsc::channel();
                let client = client.clone();
                std::thread::spawn(move || {
                    let mut client = client.lock().unwrap();
                    let result = client.get_library();
                    // Prepare data for UI (albums, playlists, error)
                    match result {
                        Ok(library_response) => {
                            if let Some(library_data) = library_response.library {
                                let albums = library_data.albums.iter().map(|(id, (title, track_ids, cover_id, is_various_artists, disc_number, total_discs, year, extra))| {
                                    crate::api::Album {
                                        id: id.clone(),
                                        title: title.clone(),
                                        track_ids: track_ids.clone(),
                                        cover_id: Some(*cover_id),
                                        is_various_artists: *is_various_artists,
                                        disc_number: *disc_number,
                                        total_discs: *total_discs,
                                        year: *year,
                                        extra: extra.clone(),
                                    }
                                }).collect::<Vec<_>>();
                                let playlists = library_data.playlists.iter().map(|(id, (title, track_ids, cover_id, is_smart, user_id, _unused, _unused2, extra))| {
                                    crate::api::Playlist {
                                        id: id.clone(),
                                        title: title.clone(),
                                        track_ids: track_ids.clone(),
                                        cover_id: Some(*cover_id),
                                        is_smart: *is_smart,
                                        user_id: Some(*user_id as u64),
                                        extra: extra.clone(),
                                    }
                                }).collect::<Vec<_>>();
                                tx.send(Ok((albums, playlists))).ok();
                            } else {
                                tx.send(Err("No library data returned".to_string())).ok();
                            }
                        }
                        Err(e) => {
                            tx.send(Err(format!("{}", e))).ok();
                        }
                    }
                });
                let login_window = login_window.clone();
                let app = app.clone();
                glib::idle_add_local(move || {
                    use std::sync::mpsc::TryRecvError;
                    match rx.try_recv() {
                        Ok(Ok((albums, playlists))) => {
                            login_window.hide();
                            let main_window = crate::ui::MainWindow::new(&app, albums, playlists);
                            main_window.show();
                            unsafe {
                                MAIN_WINDOW = Some(main_window);
                            }
                            glib::ControlFlow::Break
                        }
                        Ok(Err(e)) => {
                            log::error!("Failed to fetch library: {}", e);
                            let dialog = gtk::MessageDialog::builder()
                                .transient_for(login_window.gtk_window())
                                .modal(true)
                                .message_type(gtk::MessageType::Error)
                                .buttons(gtk::ButtonsType::Ok)
                                .text("Failed to fetch library")
                                .secondary_text(&e)
                                .build();
                            dialog.connect_response(|dialog, _| dialog.close());
                            dialog.show();
                            glib::ControlFlow::Break
                        }
                        Err(TryRecvError::Empty) => glib::ControlFlow::Continue,
                        Err(TryRecvError::Disconnected) => glib::ControlFlow::Break,
                    }
                });
            }
        });
        login_window.show();
    });

    // Run the application
    app.run();
}