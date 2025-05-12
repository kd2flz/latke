use adw::prelude::*;
use gtk::Application;
use log::{info, debug};
use std::sync::{Arc, Mutex};

mod api;
mod ui;
mod utils;

fn main() {
    // Initialize logging with debug level
    std::env::set_var("RUST_LOG", "debug");
    env_logger::init();
    info!("Starting Latke...");

    // Initialize Tokio runtime
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _guard = runtime.enter();

    // Create GTK application
    let app = Application::builder()
        .application_id("com.github.latke")
        .build();

    // Set up application activation handler
    app.connect_activate(move |app| {
        info!("Application activated");
        
        // Create API client
        let client = Arc::new(Mutex::new(api::IBroadcastClient::new()));
        
        // Create and show login window
        let login_window = ui::LoginWindow::new(app, client.clone());
        login_window.connect_login(|| {
            info!("Login successful");
            // TODO: Show main window
        });
        login_window.show();
    });

    // Run the application
    app.run();
} 