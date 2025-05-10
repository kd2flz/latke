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

    # X11 support
    xorg.xauth
    xorg.xorgserver
    xorg.libX11
    xorg.libXcursor
    xorg.libXrandr
    xorg.libXi
    xorg.libXext
    xorg.libXrender
    xorg.libXtst
    xorg.libXfixes
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXinerama
    xorg.libXxf86vm
    xorg.libXdmcp
    xorg.libXau
    xorg.libXpm
    xorg.libXv
    xorg.libXvMC
    xorg.libXxf86dga
    xorg.libXxf86misc
    xorg.libXScrnSaver
    xorg.libXt
    xorg.libXmu
    xorg.libXp
    xorg.libXpm
    xorg.libXaw
    xorg.libXres
    xorg.libXft
    xorg.libXfont2
    xorg.libXfont
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

  # Add X11 environment variables
  env.DISPLAY = ":0";
  env.XAUTHORITY = "/home/davidrhoads/.Xauthority";
  env.XDG_RUNTIME_DIR = "/run/user/1000";
  env.WAYLAND_DISPLAY = "wayland-0";
}
