{ pkgs, ... }: {
  languages.rust.enable = true;

  packages = with pkgs; [
    # Base GStreamer packages
    gst_all_1.gstreamer
    gst_all_1.gstreamer.dev
    
    # GStreamer plugins
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-base.dev
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-plugins-ugly
    gst_all_1.gst-libav
    
    # Additional GStreamer components needed
    gst_all_1.gst-plugins-bad.dev
    gst_all_1.gst-plugins-base.dev
    
    # Audio plugins specifically
    gst_all_1.gst-plugins-base.out
    
    # GTK and other dependencies
    gtk4
    libadwaita
    openssl
    pkg-config
  ];

  env.PKG_CONFIG_PATH = with pkgs; lib.makeSearchPath "lib/pkgconfig" [
    gst_all_1.gstreamer
    gst_all_1.gstreamer.dev
    gst_all_1.gst-plugins-base.dev
    gst_all_1.gst-plugins-base.out
    gst_all_1.gst-plugins-bad.dev
    gtk4
    libadwaita
    openssl.dev
  ];
}
