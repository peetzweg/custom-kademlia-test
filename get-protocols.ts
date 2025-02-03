import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { webSockets } from "@libp2p/websockets";
import { tcp } from "@libp2p/tcp";
import { multiaddr } from "@multiformats/multiaddr";
import { createLibp2p } from "libp2p";
import { peerIdFromString } from "@libp2p/peer-id";

async function getProtocols(targetMultiaddr: string) {
  // Create a libp2p node with basic capabilities
  const node = await createLibp2p({
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      dht: kadDHT({
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

    // Get all connections to this peer
    const connections = node.getConnections(peerId);

    if (connections.length === 0) {
      throw new Error("No active connections found");
    }

    const connection = connections[0];

    // Print basic connection info
    console.log("\nConnection established!");
    console.log("Remote peer ID:", connection.remotePeer.toString());
    console.log("Remote address:", connection.remoteAddr.toString());

    // Print active streams and their protocols
    console.log("\nActive stream protocols:");
    const streams = connection.streams;
    streams.forEach((stream, index) => {
      console.log(`${index + 1}. ${stream.protocol}`);
    });

    // Print multiaddr protocol information
    console.log("\nMultiaddr protocol details:");
    const tuples = addr.tuples();
    tuples.forEach((tuple) => {
      const [code, size] = tuple;
      let description;
      switch (code) {
        case 4:
          description = "IPv4 address";
          break;
        case 41:
          description = "IPv6 address";
          break;
        case 6:
          description = "TCP port";
          break;
        case 400:
          description = "WebSocket";
          break;
        case 421:
          description = "libp2p peer ID";
          break;
        default:
          description = "Unknown protocol";
          break;
      }
      console.log(`- ${description} (code: ${code}, size: ${size} bits)`);
    });

    // Try to negotiate some common protocols
    const commonProtocols = [
      "/ipfs/kad/1.0.0",
      "/ipfs/kad/2.0.0",
      "/libp2p/kad/1.0.0",
      "/libp2p/kad/2.0.0",
      "/ipfs/id/1.0.0",
      "/ipfs/id/push/1.0.0",
      "/ipfs/ping/1.0.0",
      "/ipfs/bitswap/1.0.0",
      "/ipfs/bitswap/1.1.0",
      "/ipfs/bitswap/1.2.0",
    ];

    console.log("\nTesting common protocol support:");
    for (const protocol of commonProtocols) {
      try {
        const stream = await connection.newStream(protocol);
        console.log(`✓ ${protocol} (supported)`);
        await stream.close();
      } catch (e) {
        console.log(`✗ ${protocol} (not supported)`);
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
    "Example: ts-node get-protocols.ts /ip4/127.0.0.1/tcp/37999/ws/p2p/12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm"
  );
  process.exit(1);
}

// Run the function with the provided multiaddr
getProtocols(targetMultiaddr).catch(console.error);
