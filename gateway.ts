import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import { createHelia } from "helia";
import { createLibp2p } from "libp2p";
import { multiaddr } from "@multiformats/multiaddr";
import { MemoryBlockstore } from "blockstore-core";
import { CID } from "multiformats/cid";
import { blake2b256 } from "@multiformats/blake2/blake2b";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { SERVER_CONFIG, PEER_CONFIG, DHT_PROTOCOL } from "./config.js";

// Create Fastify server
const fastify = Fastify({
  logger: true,
});

// Enable CORS
await fastify.register(cors, {
  origin: true,
});

// Create a Helia node and ensure connection to bootnode
async function createNode() {
  const libp2p = await createLibp2p({
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      dht: kadDHT({
        protocol: DHT_PROTOCOL,
        clientMode: true,
      }),
    },
  });

  const blockstore = new MemoryBlockstore();
  const helia = await createHelia({
    libp2p,
    blockstore,
    hashers: [blake2b256],
  });

  console.log(
    "Helia node started with peer ID:",
    helia.libp2p.peerId.toString()
  );

  // Connect to the bootnode
  try {
    const bootnode = multiaddr(PEER_CONFIG.BOOTNODE);
    console.log("Connecting to bootnode:", bootnode.toString());
    await helia.libp2p.dial(bootnode);
    console.log("Successfully connected to bootnode!");
  } catch (err: any) {
    console.error("Failed to connect to bootnode:", err.message);
    // Exit if we can't connect to the bootnode
    process.exit(1);
  }

  return helia;
}

// Initialize Helia node
let heliaNode: Awaited<ReturnType<typeof createNode>>;
try {
  heliaNode = await createNode();
} catch (err) {
  console.error("Failed to create Helia node:", err);
  process.exit(1);
}

// Define route to get IPFS blocks
fastify.get("/ipfs/:cid", async (request, reply) => {
  const { cid } = request.params as { cid: string };

  try {
    // Parse and validate the CID
    const parsedCid = CID.parse(cid);

    // Fetch the block
    const block = await heliaNode.blockstore.get(parsedCid);

    // Try to decode as UTF-8 text first
    try {
      const text = new TextDecoder().decode(block);
      reply.header("Content-Type", "text/plain");
      return text;
    } catch {
      // If not valid UTF-8, send as binary
      reply.header("Content-Type", "application/octet-stream");
      return block;
    }
  } catch (err: any) {
    reply.code(404);
    return { error: `Block not found: ${err.message}` };
  }
});

// Start the server
try {
  await fastify.listen({
    port: SERVER_CONFIG.PORT,
    host: SERVER_CONFIG.HOST,
  });
  console.log(
    `Gateway listening on http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}`
  );
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await heliaNode.stop();
  await fastify.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await heliaNode.stop();
  await fastify.close();
  process.exit(0);
});
