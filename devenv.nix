{ pkgs, lib, config, ... }: {
  languages.rust.enable = true;

  packages = with pkgs; [
    # Core GStreamer
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-base.dev  # Required for pkg-config files
    gst_all_1.gst-plugins-good
    
    # GUI dependencies
    gtk4
    libadwaita
    openssl
    
    # Essential build tools
    pkg-config
  ];

  # Add environment variables explicitly
  env.PKG_CONFIG_PATH = lib.makeSearchPathOutput "dev" "lib/pkgconfig" [
    gst_all_1.gst-plugins-base
  ];
}
