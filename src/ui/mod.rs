use adw::prelude::*;
use gtk::{Align, Button, Entry, Label, PasswordEntry};
use std::rc::Rc;

use crate::api::IBroadcastClient;

pub struct LoginWindow {
    window: adw::Window,
    email_entry: Entry,
    password_entry: PasswordEntry,
    login_button: Button,
    client: Rc<IBroadcastClient>,
}

impl LoginWindow {
    pub fn new(client: Rc<IBroadcastClient>) -> Self {
        let window = adw::Window::new();
        window.set_title(Some("Latke - Login"));
        window.set_default_size(400, 300);

        let box_ = gtk::Box::builder()
            .orientation(gtk::Orientation::Vertical)
            .spacing(12)
            .margin_top(12)
            .margin_bottom(12)
            .margin_start(12)
            .margin_end(12)
            .build();

        let title = Label::builder()
            .label("Welcome to Latke")
            .css_classes(&["title-1"])
            .build();

        let email_label = Label::builder()
            .label("Email")
            .xalign(0.0)
            .build();

        let email_entry = Entry::builder()
            .placeholder_text("Enter your email")
            .build();

        let password_label = Label::builder()
            .label("Password")
            .xalign(0.0)
            .build();

        let password_entry = PasswordEntry::builder()
            .placeholder_text("Enter your password")
            .build();

        let login_button = Button::builder()
            .label("Login")
            .css_classes(&["suggested-action"])
            .build();

        box_.append(&title);
        box_.append(&email_label);
        box_.append(&email_entry);
        box_.append(&password_label);
        box_.append(&password_entry);
        box_.append(&login_button);

        window.set_content(Some(&box_));

        Self {
            window,
            email_entry,
            password_entry,
            login_button,
            client,
        }
    }

    pub fn show(&self) {
        self.window.present();
    }

    pub fn connect_login<F>(&self, callback: F)
    where
        F: Fn(String, String) + 'static,
    {
        let email_entry = self.email_entry.clone();
        let password_entry = self.password_entry.clone();
        let login_button = self.login_button.clone();

        login_button.connect_clicked(move |_| {
            let email = email_entry.text().to_string();
            let password = password_entry.text().to_string();
            callback(email, password);
        });
    }
} 