import { multiaddr } from "@multiformats/multiaddr";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Server configuration
export const SERVER_CONFIG = {
  PORT: parseInt(process.env.GATEWAY_PORT || "3000", 10),
  HOST: process.env.GATEWAY_HOST || "localhost", // Use "0.0.0.0" to expose to the web
};

// Peer configuration
export const PEER_CONFIG = {
  BOOTNODE:
    process.env.BOOTNODE_MULTIADDR ||
    "/ip4/127.0.0.1/tcp/4001/p2p/12D3KooWSYPe8ntNbUhX5BbkD1ZfFkEwoVBeUtSamJZxKiD8yxY8",
};

// Parse and validate the bootnode multiaddr at startup
try {
  multiaddr(PEER_CONFIG.BOOTNODE);
} catch (err: any) {
  console.error("Invalid bootnode multiaddr:", err.message);
  process.exit(1);
}

// DHT protocol configuration
export const DHT_PROTOCOL =
  "/f2a6b4e89857a1d65c9a068ef6280dcbc5f96055fd01131188f9d764b54d87e8/kad";
