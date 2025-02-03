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
import type { PeerId } from "@libp2p/interface-peer-id";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";

async function listHeliaBlocks(targetMultiaddr: string) {
  // Create a libp2p node with our custom configuration
  const libp2p = await createLibp2p({
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      dht: kadDHT({
        // protocol:
        //   "/ddb1e4f77487bc0e05aeb2d3605bd20dfcfd3b6a42cafb718bacbeb0c7a7a60f/kad",
        clientMode: false, // Set to false to allow full DHT participation
      }),
    },
  });

  try {
    // Create a Helia node with our libp2p instance
    const blockstore = new MemoryBlockstore();
    const helia = await createHelia({
      libp2p,
      blockstore,
    });

    console.log(
      "Helia node started with peer ID:",
      helia.libp2p.peerId.toString()
    );

    // Connect to the target peer
    console.log(`\nConnecting to ${targetMultiaddr}...`);
    const targetPeer = await helia.libp2p.dial(multiaddr(targetMultiaddr));
    console.log("Connected successfully!");

    // Get the remote peer's ID
    const remotePeerId = targetPeer.remotePeer;
    console.log(`\nConnected to peer: ${remotePeerId.toString()}`);

    console.log("\nPeer Information:");
    console.log("----------------");

    // Get connection information
    const connections = libp2p.getConnections(remotePeerId);
    console.log(`\nActive Connections: ${connections.length}`);

    for (const connection of connections) {
      console.log("\nConnection Details:");
      console.log(`- Remote Address: ${connection.remoteAddr.toString()}`);
      console.log(`- Direction: ${connection.direction}`);
      console.log(`- Multiplexer: ${connection.multiplexer}`);
      console.log(`- Encryption: ${connection.encryption}`);

      // List streams
      const streams = connection.streams;
      console.log(`\nActive Streams: ${streams.length}`);
      for (const stream of streams) {
        console.log(`- Protocol: ${stream.protocol}`);
        console.log(`- Direction: ${stream.direction}`);
      }
    }

    // Get DHT information
    const dht = libp2p.services.dht;
    if (dht) {
      console.log("\nDHT Information:");

      // Query the DHT for the peer
      console.log("\nQuerying DHT for peer information...");
      try {
        for await (const event of dht.findPeer(remotePeerId)) {
          if (event.name === "FINAL_PEER") {
            console.log("Found peer in DHT:");
            const multiaddrs = event.peer.multiaddrs.map((ma) => ma.toString());
            console.log(`- Addresses: ${multiaddrs.join(", ")}`);
          }
        }
      } catch (err) {
        console.log("Peer not found in DHT");
      }

      // Get peer routing information
      console.log("\nPeer Routing Information:");
      const foundPeers: string[] = [];
      try {
        // Convert the peer ID to a Uint8Array for DHT query
        const peerIdBytes = uint8ArrayFromString(remotePeerId.toString());

        for await (const event of dht.getClosestPeers(peerIdBytes)) {
          if (event.name === "PEER_RESPONSE" && event.closer.length > 0) {
            foundPeers.push(event.closer[0].id.toString());
            if (foundPeers.length >= 5) break;
          }
        }

        console.log(`Found ${foundPeers.length} closest peers in the DHT`);

        // Display the closest peers
        console.log("\nSample of closest peers:");
        for (const peer of foundPeers) {
          console.log(`- Peer: ${peer}`);
        }
      } catch (err) {
        console.log("Failed to get closest peers:", err);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    // Clean up
    await libp2p.stop();
  }
}

// Check if required argument was provided
if (process.argv.length < 3) {
  console.error("Please provide a multiaddr as a command line argument");
  console.error(
    "Example: ts-node list-blocks.ts /ip4/127.0.0.1/tcp/37999/ws/p2p/12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm"
  );
  process.exit(1);
}

const targetMultiaddr = process.argv[2];

// Run the function with the provided argument
listHeliaBlocks(targetMultiaddr).catch(console.error);
