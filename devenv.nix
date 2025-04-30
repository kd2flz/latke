{ pkgs, ... }:

{
  # Enable development environment
  env = {
    RUST_BACKTRACE = "1";
    RUST_LOG = "info";
  };

  # Development packages
  packages = with pkgs; [
    # Rust toolchain
    (rust-bin.stable.latest.default.override {
      extensions = [ "rust-src" "rust-analyzer" ];
      targets = [ "x86_64-unknown-linux-gnu" "x86_64-pc-windows-gnu" ];
    })

    # GTK 4 and dependencies
    gtk4
    libadwaita
    gdk-pixbuf
    pkg-config
    glib
    gtk4.dev

    # GStreamer and plugins
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-plugins-ugly
    gst_all_1.gst-libav

    # Development tools
    cargo
    cargo-watch
    rustfmt
    clippy
    pkg-config
    cmake
    gcc
    openssl
    openssl.dev
    pkg-config
  ];

  # Shell hooks
  enterShell = ''
    # Set up environment variables for GTK and GStreamer
    export GST_PLUGIN_SYSTEM_PATH_1_0=${pkgs.gst_all_1.gst-plugins-base}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-good}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-bad}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-ugly}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-libav}/lib/gstreamer-1.0
    export GST_PLUGIN_PATH_1_0=$GST_PLUGIN_SYSTEM_PATH_1_0
    export LD_LIBRARY_PATH=${pkgs.gst_all_1.gstreamer}/lib:${pkgs.glib}/lib:${pkgs.gtk4}/lib:${pkgs.libadwaita}/lib:$LD_LIBRARY_PATH
    export PKG_CONFIG_PATH=${pkgs.gtk4}/lib/pkgconfig:${pkgs.glib}/lib/pkgconfig:${pkgs.gdk-pixbuf}/lib/pkgconfig:${pkgs.libadwaita}/lib/pkgconfig:$PKG_CONFIG_PATH

    # Print welcome message
    echo "Welcome to Latke development environment!"
    echo "Available commands:"
    echo "  cargo build    - Build the project"
    echo "  cargo run      - Run the application"
    echo "  cargo test     - Run tests"
    echo "  cargo fmt      - Format code"
    echo "  cargo clippy   - Run linter"
  '';

  # Enable direnv integration
  dotenv.enable = true;

  # Enable pre-commit hooks
  pre-commit.hooks = {
    rustfmt.enable = true;
    clippy.enable = true;
  };
} 