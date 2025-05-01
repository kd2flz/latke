use anyhow::Result;
use keyring::Entry;
use log::info;

#[allow(dead_code)]
pub fn save_credentials(service: &str, username: &str, password: &str) -> Result<()> {
    let entry = Entry::new(service, username)?;
    entry.set_password(password)?;
    info!("Credentials saved for user: {}", username);
    Ok(())
}

#[allow(dead_code)]
pub fn get_credentials(service: &str, username: &str) -> Result<String> {
    let entry = Entry::new(service, username)?;
    let password = entry.get_password()?;
    info!("Retrieved credentials for user: {}", username);
    Ok(password)
}

#[allow(dead_code)]
pub fn delete_credentials(service: &str, username: &str) -> Result<()> {
    let entry = Entry::new(service, username)?;
    entry.delete_password()?;
    info!("Deleted credentials for user: {}", username);
    Ok(())
} 