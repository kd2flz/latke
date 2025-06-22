use adw::prelude::*;
use glib::spawn_future_local;
use gtk::{Application, Button, Label, Box as GtkBox, Spinner, Entry};
use std::sync::{Arc, Mutex};

use crate::api::IBroadcastClient;
mod hostname;
use crate::ui::hostname::get_hostname;

#[derive(Clone)]
pub struct LoginWindow {
    window: adw::Window,
    device_code_entry: Entry,
    status_label: Label,
    spinner: Spinner,
    submit_button: Button,
    #[allow(dead_code)]
    client: Arc<Mutex<IBroadcastClient>>,
    #[allow(dead_code)]
    app: Application,
}

impl LoginWindow {
    pub fn new(app: &Application, client: Arc<Mutex<IBroadcastClient>>) -> Self {
        let window = adw::Window::new();
        window.set_application(Some(app));
        window.set_title(Some("Latke - Login"));
        window.set_default_size(400, 300);

        let box_ = GtkBox::builder()
            .orientation(gtk::Orientation::Vertical)
            .spacing(12)
            .margin_top(12)
            .margin_bottom(12)
            .margin_start(12)
            .margin_end(12)
            .build();

        let title = Label::builder()
            .label("Welcome to Latke")
            .css_classes(vec!["title-1"])
            .build();

        let instructions = Label::builder()
            .label("Please enter the device code from your iBroadcast account settings:")
            .wrap(true)
            .wrap_mode(gtk::pango::WrapMode::Word)
            .build();

        let device_code_entry = Entry::builder()
            .placeholder_text("Enter device code")
            .build();

        let status_label = Label::builder()
            .label("")
            .build();

        let spinner = Spinner::builder()
            .spinning(false)
            .build();

        let submit_button = Button::builder()
            .label("Submit")
            .build();

        box_.append(&title);
        box_.append(&instructions);
        box_.append(&device_code_entry);
        box_.append(&status_label);
        box_.append(&spinner);
        box_.append(&submit_button);

        window.set_content(Some(&box_));

        Self {
            window,
            device_code_entry,
            status_label,
            spinner,
            submit_button,
            client,
            app: app.clone(),
        }
    }

    pub fn show(&self) {
        self.window.present();
    }

    pub fn hide(&self) {
        self.window.hide();
    }

    pub fn gtk_window(&self) -> &adw::Window {
        &self.window
    }

    pub fn connect_login<F>(&self, callback: F)
    where
        F: Fn() + 'static,
    {
        let client = self.client.clone();
        let device_code_entry = self.device_code_entry.clone();
        let status_label = self.status_label.clone();
        let spinner = self.spinner.clone();
        let submit_button = self.submit_button.clone();
        let callback = std::sync::Arc::new(callback);

        let submit_button_clone = submit_button.clone();
        submit_button.connect_clicked(move |_| {
            let device_code = device_code_entry.text().to_string();
            if device_code.is_empty() {
                status_label.set_text("Please enter a device code");
                return;
            }

            // Start spinner and disable input
            spinner.set_spinning(true);
            submit_button_clone.set_sensitive(false);
            device_code_entry.set_sensitive(false);
            status_label.set_text("Authenticating...");

            let client = client.clone();
            let device_code = device_code.clone();
            let status_label = status_label.clone();
            let spinner = spinner.clone();
            let submit_button = submit_button_clone.clone();
            let device_code_entry = device_code_entry.clone();
            let callback = callback.clone();

            spawn_future_local(async move {
                let mut client = client.lock().unwrap();
                let device_name = get_hostname();
                match client.poll_device_code(&device_code, &device_name).await {
                    Ok(response) => {
                        if response.result && response.user.as_ref().and_then(|u| u.token.as_ref()).is_some() {
                            status_label.set_text("Authentication successful!");
                            spinner.set_spinning(false);
                            callback();
                        } else {
                            status_label.set_text("Invalid device code. Please try again.");
                            spinner.set_spinning(false);
                            submit_button.set_sensitive(true);
                            device_code_entry.set_sensitive(true);
                        }
                    }
                    Err(e) => {
                        status_label.set_text(&format!("Error: {}", e));
                        spinner.set_spinning(false);
                        submit_button.set_sensitive(true);
                        device_code_entry.set_sensitive(true);
                    }
                }
            });
        });
    }
}

pub struct MainWindow {
    window: adw::Window,
    album_list: gtk::ListBox,
    playlist_list: gtk::ListBox,
}

impl MainWindow {
    pub fn new(app: &gtk::Application, albums: Vec<crate::api::Album>, playlists: Vec<crate::api::Playlist>) -> Self {
        let window = adw::Window::new();
        window.set_application(Some(app));
        window.set_title(Some("Latke - Library"));
        window.set_default_size(600, 400);

        let vbox = gtk::Box::new(gtk::Orientation::Vertical, 12);
        let album_label = gtk::Label::new(Some("Albums"));
        let album_list = gtk::ListBox::new();
        for album in &albums {
            let row = gtk::Label::new(Some(&album.title));
            album_list.append(&row);
        }
        vbox.append(&album_label);
        vbox.append(&album_list);

        let playlist_label = gtk::Label::new(Some("Playlists"));
        let playlist_list = gtk::ListBox::new();
        for playlist in &playlists {
            let row = gtk::Label::new(Some(&playlist.title));
            playlist_list.append(&row);
        }
        vbox.append(&playlist_label);
        vbox.append(&playlist_list);

        window.set_content(Some(&vbox));

        Self { window, album_list, playlist_list }
    }

    pub fn show(&self) {
        self.window.present();
    }

    pub fn gtk_window(&self) -> &adw::Window {
        &self.window
    }
}