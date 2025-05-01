{ pkgs, lib, config, ... }: {
  # https://devenv.sh/languages/
  languages.rust.enable = true;

  # https://devenv.sh/packages/
  packages = with pkgs; [
    gstreamer
    gtk4
    libadwaita
  ];

  # See full reference at https://devenv.sh/reference/options/
}
