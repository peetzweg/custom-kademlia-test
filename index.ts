import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { peerIdFromString } from "@libp2p/peer-id";
import { webSockets } from "@libp2p/websockets";
import { tcp } from "@libp2p/tcp";
import { multiaddr } from "@multiformats/multiaddr";
import { createLibp2p } from "libp2p";

const bootstrapAddr =
  "/ip4/127.0.0.1/tcp/37999/ws/p2p/12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm";

const node = await createLibp2p({
  transports: [webSockets(), tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    dht: kadDHT(),
    identify: identify(),
  },
});

// Start the node
console.log("Starting node");
await node.start();
console.log("Node peer ID:", node.peerId.toString());

try {
  // Connect to the bootstrap node first
  console.log("Dialing bootstrap node");
  await node.dial(multiaddr(bootstrapAddr));

  // Get protocols from the bootstrap peer
  const bootstrapPeerId = peerIdFromString(
    "12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm"
  );
  console.log("\nBootstrap peer protocols:");
  const connections = node.getConnections(bootstrapPeerId);
  if (connections.length > 0) {
    const connection = connections[0];
    const streams = connection.streams;
    console.log(
      "Active stream protocols:",
      streams.map((s) => s.protocol).join(", ")
    );

    // Try different KAD DHT protocol versions
    // Genesis
    // ddb1e4f77487bc0e05aeb2d3605bd20dfcfd3b6a42cafb718bacbeb0c7a7a60f
    const kadProtocols = [
      "/ddb1e4f77487bc0e05aeb2d3605bd20dfcfd3b6a42cafb718bacbeb0c7a7a60f/kad/1.0.0",
      "/ipfs/kad/1.0.0",
      "/ipfs/kad/2.0.0",
      "/libp2p/kad/1.0.0",
      "/libp2p/kad/2.0.0",
    ];

    for (const protocol of kadProtocols) {
      try {
        console.log(`\nTrying to negotiate ${protocol}...`);
        const kadStream = await connection.newStream(protocol);
        console.log(`Successfully negotiated ${protocol}`);
        await kadStream.close();
      } catch (e: any) {
        console.log(`Could not negotiate ${protocol}:`, e.message);
      }
    }
  }

  // Connect to the second peer
  //   const secondPeerAddr =
  //     "/ip4/192.168.178.56/tcp/4001/p2p/12D3KooWSYPe8ntNbUhX5BbkD1ZfFkEwoVBeUtSamJZxKiD8yxY8";
  //   console.log("Dialing second peer");
  //   await node.dial(multiaddr(secondPeerAddr));

  // Look up the same peer ID
  const peerId = peerIdFromString(
    "12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm"
  );
  console.log("Finding peer");
  const peerInfo = await node.peerRouting.findPeer(peerId);
  console.info(peerInfo); // peer id, multiaddrs

  // List all connected peers and their protocols
  console.log("\nConnected peers and their protocols:");
  const peers = node.getPeers();
  for (const peer of peers) {
    const connection = node.getConnections(peer)[0];
    if (connection) {
      const addr = connection.remoteAddr;
      console.log(`\nPeer ${peer.toString()}:`);

      // Get the full protocol description
      const tuples = addr.tuples();
      console.log("Protocols and their sizes:");
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

      // Also show the full multiaddr for reference
      console.log("Full address:", addr.toString());
    }
  }
} catch (err) {
  console.error("Error finding peer:", err);
} finally {
  // Clean up by stopping the node
  await node.stop();
}
