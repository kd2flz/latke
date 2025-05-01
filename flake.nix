{
  description = "A cross-platform desktop client for iBroadcast music service";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    devenv.url = "github:cachix/devenv";
  };

  outputs = { self, nixpkgs, flake-utils, devenv }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = devenv.lib.mkShell {
          inherit pkgs;
          inputs = { inherit nixpkgs; };
          modules = [
            {
              # Import your devenv configuration
              imports = [ ./devenv.nix ];
              # Add self reference
              _module.args.self = self;
            }
          ];
        };
      });
}