{ pkgs, lib, config, ... }: {
  # https://devenv.sh/languages/
  languages.rust.enable = true;

  # https://devenv.sh/packages/
  packages = with pkgs; [
    gst_all_1.gstreamer
    gtk4
    libadwaita
    openssl
  ];

  # See full reference at https://devenv.sh/reference/options/
}
