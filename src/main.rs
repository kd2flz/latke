use adw::prelude::*;
use gtk::Application;
use log::{error, info, debug};
use std::sync::{Arc, Mutex};

mod api;
mod ui;
mod utils;

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::init();
    info!("Starting Latke...");

    // Create a new application
    debug!("Creating GTK application...");
    let app = Application::builder()
        .application_id("com.ibroadcast.latke")
        .build();

    debug!("Setting up application activation handler...");
    app.connect_activate(|app| {
        debug!("Application activated");
        // Create the API client
        let client = Arc::new(Mutex::new(api::IBroadcastClient::new()));

        // Create the login window
        debug!("Creating login window...");
        let login_window = ui::LoginWindow::new(app, client.clone());
        
        // Handle login attempts
        debug!("Setting up login handler...");
        login_window.connect_login(move |email, password| {
            let client = client.clone();
            let email_clone = email.clone();
            
            // Spawn a new task for the login attempt
            glib::spawn_future_local(async move {
                match client.lock().unwrap().login(&email, &password).await {
                    Ok(_) => {
                        info!("Login successful for user: {}", email_clone);
                        // TODO: Save credentials and show main window
                    }
                    Err(e) => {
                        error!("Login error: {}", e);
                        // TODO: Show error message to user
                    }
                }
            });
        });

        // Show the login window
        debug!("Showing login window...");
        login_window.show();
    });

    // Run the application
    debug!("Starting GTK main loop...");
    app.run();
    debug!("GTK main loop ended");
} 