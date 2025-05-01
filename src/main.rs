use adw::prelude::*;
use gtk::Application;
use log::{error, info};
use std::sync::{Arc, Mutex};

mod api;
mod ui;
mod utils;

fn main() {
    // Initialize logging
    env_logger::init();
    info!("Starting Latke...");

    // Create a new application
    let app = Application::builder()
        .application_id("com.ibroadcast.latke")
        .build();

    app.connect_activate(|_app| {
        // Create the API client
        let client = Arc::new(Mutex::new(api::IBroadcastClient::new()));

        // Create the login window
        let login_window = ui::LoginWindow::new(client.clone());
        
        // Handle login attempts
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
        login_window.show();
    });

    // Run the application
    app.run();
} 