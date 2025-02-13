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

async function startHeliaNode(targetMultiaddr: string, cidString: string) {
  // Create a libp2p node with our custom configuration
  const libp2p = await createLibp2p({
    transports: [webSockets(), tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      dht: kadDHT({
        protocol:
          "/f2a6b4e89857a1d65c9a068ef6280dcbc5f96055fd01131188f9d764b54d87e8/kad",
        clientMode: true,
      }),
    },
  });

  try {
    // Create a Helia node with our libp2p instance
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

    // Connect to the target peer
    console.log(`\nConnecting to ${targetMultiaddr}...`);
    const targetPeer = multiaddr(targetMultiaddr);
    await helia.libp2p.dial(targetPeer);
    console.log("Connected successfully!");

    // Parse the CID
    const cid = CID.parse(cidString);
    console.log(`\nAttempting to fetch block with CID: ${cid.toString()}`);

    try {
      // Wait a moment for the DHT to be ready and connection to be established
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to get the block - Helia will automatically use bitswap to fetch from peers
      const block = await helia.blockstore.get(cid);
      console.log("\nSuccessfully retrieved block:");
      console.log("Block data:", new TextDecoder().decode(block));
    } catch (err) {
      console.error("Failed to retrieve block:", err);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    // Clean up
    await libp2p.stop();
  }
}

// Check if required arguments were provided
if (process.argv.length < 4) {
  console.error(
    "Please provide both a multiaddr and a CID as command line arguments"
  );
  console.error(
    "Example: ts-node helia.ts /ip4/127.0.0.1/tcp/37999/ws/p2p/12D3KooWQCkBm1BYtkHpocxCwMgR8yjitEeHGx8spzcDLGt2gkBm QmExample..."
  );
  process.exit(1);
}

const targetMultiaddr = process.argv[2];
const cidString = process.argv[3];

// Run the function with the provided arguments
startHeliaNode(targetMultiaddr, cidString).catch(console.error);
