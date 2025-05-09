# Latke - iBroadcast Desktop Client

A cross-platform desktop client for the iBroadcast music service, built with Rust and GTK 4.

## IMPORTANT NOTE: 
** 

## Features

- Modern, responsive UI using GTK 4 and libadwaita
- Secure authentication and credential management
- Music library browsing and management
- Full playback controls with queue management
- Local caching for offline playback
- Cross-platform support (Linux, Windows, macOS)

## Development Environment

### Using Nix (Recommended)

The project includes a Nix flake with a development environment that provides all necessary dependencies.

1. Install Nix using the Determinate Nix Installer:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/kd2flz/latke.git
   cd latke
   ```

3. Enter the development environment:
   ```bash
   # With direnv (recommended)
   direnv allow

   # Or manually
   nix develop --no-pure-eval
   ```

### Manual Setup

#### Windows
1. Install [Rust](https://rustup.rs/)
2. Install [GTK 4](https://www.gtk.org/docs/installations/windows/)
3. Install [GStreamer](https://gstreamer.freedesktop.org/download/)

#### Linux
1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Install GTK 4 and GStreamer development packages:
   ```bash
   # Ubuntu/Debian
   sudo apt install libgtk-4-dev libgstreamer1.0-dev gstreamer1.0-plugins-base gstreamer1.0-plugins-good

   # Fedora
   sudo dnf install gtk4-devel gstreamer1-devel gstreamer1-plugins-base-devel gstreamer1-plugins-good
   ```

## Building

1. Build the project:
   ```bash
   cargo build --release
   ```

2. Run the application:
   ```bash
   cargo run
   ```

## Development

The project is organized into several modules:

- `api/`: iBroadcast API client implementation
- `ui/`: GTK 4 UI components
- `utils/`: Common utility functions

### Development Tools

The Nix development environment includes:

- Latest stable Rust toolchain with rust-analyzer
- GTK 4 and libadwaita development files
- GStreamer and plugins
- Development tools (cargo, rustfmt, clippy, etc.)
- Pre-commit hooks for code formatting and linting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GPL-3.0-or-later License - see the LICENSE file for details. 