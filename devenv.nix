{ pkgs, lib, config, ... }: {
  languages.rust.enable = true;

  packages = with pkgs; [
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-plugins-ugly
    gst_all_1.gst-libav
    gtk4
    libadwaita
    openssl
    pkg-config
    gst_all_1.gstreamer.dev
    gst_all_1.gst-plugins-base.dev
    gst_all_1.gst-plugins-good.dev
    gst_all_1.gst-plugins-bad.dev
    gst_all_1.gst-plugins-ugly.dev
    gst_all_1.gst-libav.dev
    gst_all_1.gst-plugins-base.out
    gst_all_1.gst-plugins-good.out
    gst_all_1.gst-plugins-bad.out
    gst_all_1.gst-plugins-ugly.out
    gst_all_1.gst-libav.out
    gst_all_1.gst-plugins-base.dev.out
    gst_all_1.gst-plugins-base.dev.dev
  ];

  env.PKG_CONFIG_PATH = lib.makeSearchPathOutput "dev" "lib/pkgconfig" [
    pkgs.gst_all_1.gstreamer.dev
    pkgs.gst_all_1.gst-plugins-base.dev
    pkgs.gst_all_1.gst-plugins-good.dev
    pkgs.gst_all_1.gst-plugins-bad.dev
    pkgs.gst_all_1.gst-plugins-ugly.dev
    pkgs.gst_all_1.gst-libav.dev
    pkgs.gst_all_1.gst-plugins-base.dev.out
    pkgs.gst_all_1.gst-plugins-base.dev.dev
    pkgs.gst_all_1.gst-plugins-base.out
    pkgs.gst_all_1.gst-plugins-good.out
    pkgs.gst_all_1.gst-plugins-bad.out
    pkgs.gst_all_1.gst-plugins-ugly.out
    pkgs.gst_all_1.gst-libav.out
  ];
}
