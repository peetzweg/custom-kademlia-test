import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { webSockets } from "@libp2p/websockets";
import { tcp } from "@libp2p/tcp";
import { createLibp2p } from "libp2p";

async function startNode() {
  // Create the libp2p node
  const node = await createLibp2p({
    addresses: {
      listen: ["/ip4/0.0.0.0/tcp/0", "/ip4/0.0.0.0/tcp/0/ws"], // Random ports
    },
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      dht: kadDHT({
        protocol:
          "/ddb1e4f77487bc0e05aeb2d3605bd20dfcfd3b6a42cafb718bacbeb0c7a7a60f/kad/1.0.0",
        clientMode: false,
      }),
      identify: identify(),
    },
  });

  // Start the node
  await node.start();
  console.log("Node started!");
  console.log("Node peer ID:", node.peerId.toString());
  console.log("Node listening on addresses:");
  node.getMultiaddrs().forEach((addr) => {
    console.log(addr.toString());
  });

  // Log various events
  node.addEventListener("peer:connect", (evt) => {
    console.log("Connected to peer:", evt.detail.toString());
  });

  node.addEventListener("peer:disconnect", (evt) => {
    console.log("Disconnected from peer:", evt.detail.toString());
  });

  // Keep the process running
  process.on("SIGINT", async () => {
    console.log("\nStopping node...");
    await node.stop();
    process.exit(0);
  });

  // Log periodic stats
  setInterval(() => {
    const peers = node.getPeers();
    console.log(`\nConnected to ${peers.length} peers:`);
    peers.forEach((peer) => {
      const connections = node.getConnections(peer);
      connections.forEach((connection) => {
        console.log(
          `- ${peer.toString()} via ${connection.remoteAddr.toString()}`
        );
        console.log(
          "  Active streams:",
          connection.streams.map((s) => s.protocol).join(", ")
        );
      });
    });
  }, 10000); // Every 30 seconds
}

// Start the node
startNode().catch(console.error);
