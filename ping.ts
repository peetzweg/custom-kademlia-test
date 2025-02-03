import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { webSockets } from "@libp2p/websockets";
import { tcp } from "@libp2p/tcp";
import { multiaddr } from "@multiformats/multiaddr";
import { createLibp2p } from "libp2p";
import { peerIdFromString } from "@libp2p/peer-id";

async function pingPeer(targetMultiaddr: string) {
  // Create a libp2p node with basic capabilities
  const node = await createLibp2p({
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      dht: kadDHT({
        protocol: "/dot/kad/1.0.0",
        clientMode: true,
      }),
    },
  });

  try {
    // Start the node
    await node.start();
    console.log("Node started with peer ID:", node.peerId.toString());

    // Connect to the target address
    console.log(`\nConnecting to ${targetMultiaddr}...`);
    await node.dial(multiaddr(targetMultiaddr));

    // Get the peer ID from the multiaddr
    const addr = multiaddr(targetMultiaddr);
    const peerIdStr = addr.getPeerId();

    if (!peerIdStr) {
      throw new Error("No peer ID found in multiaddr");
    }

    // Convert string peer ID to PeerId object
    const peerId = peerIdFromString(peerIdStr);

    console.log("\nStarting continuous ping...");
    console.log("Press Ctrl+C to stop\n");

    // Continuous ping loop
    while (true) {
      try {
        const connection = node.getConnections(peerId)[0];
        if (!connection) {
          throw new Error("No active connection");
        }

        const startTime = Date.now();
        const stream = await connection.newStream("/ipfs/ping/1.0.0");

        // Send a ping message (empty buffer in this case)
        await stream.sink([new Uint8Array(0)]);

        // Wait for response
        for await (const _ of stream.source) {
          const latency = Date.now() - startTime;
          console.log(`Ping response from ${peerIdStr}: time=${latency}ms`);
          break;
        }

        await stream.close();

        // Wait 1 second before next ping
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e: any) {
        console.error("Ping failed:", e.message);
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    // Clean up
    await node.stop();
  }
}

// Check if a multiaddr was provided as a command line argument
const targetMultiaddr = process.argv[2];
if (!targetMultiaddr) {
  console.error("Please provide a multiaddr as a command line argument");
  console.error(
    "Example: ts-node ping.ts /ip4/127.0.0.1/tcp/37999/ws/p2p/12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm"
  );
  process.exit(1);
}

// Run the function with the provided multiaddr
pingPeer(targetMultiaddr).catch(console.error);
