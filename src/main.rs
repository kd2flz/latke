use adw::prelude::*;
use gtk::prelude::*;
use gtk::{Application, ApplicationWindow};
use log::{error, info};
use std::rc::Rc;

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

    app.connect_activate(|app| {
        // Create the API client
        let client = Rc::new(api::IBroadcastClient::new());

        // Create the login window
        let login_window = ui::LoginWindow::new(client.clone());
        
        // Handle login attempts
        login_window.connect_login(move |email, password| {
            let client = client.clone();
            let email_clone = email.clone();
            
            // Spawn a new task for the login attempt
            glib::spawn_future_local(async move {
                match client.login(&email, &password).await {
                    Ok(response) => {
                        if response.status == "OK" {
                            info!("Login successful for user: {}", email_clone);
                            // TODO: Save credentials and show main window
                        } else {
                            error!("Login failed: {}", response.status);
                            // TODO: Show error message to user
                        }
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