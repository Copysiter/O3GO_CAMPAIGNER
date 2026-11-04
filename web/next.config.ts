import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Next's dev-origin check otherwise allows localhost but blocks HMR when the
// same server is opened from a phone using this computer's LAN address.
const localAddresses = Object.values(networkInterfaces()).flatMap(
  (addresses) =>
    addresses
      ?.filter(({ family, internal }) => family === "IPv4" && !internal)
      .map(({ address }) => address) ?? [],
);

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: localAddresses,
  // FastAPI deliberately mixes /resource/ collections and /resource/id actions.
  // Preserve the requested path before the transparent transport handles it.
  skipTrailingSlashRedirect: true,
};
export default config;
