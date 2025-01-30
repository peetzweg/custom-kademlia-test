"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var kad_dht_1 = require("@libp2p/kad-dht");
var libp2p_1 = require("libp2p");
var peer_id_1 = require("@libp2p/peer-id");
var node = await (0, libp2p_1.createLibp2p)({
    services: {
        dht: (0, kad_dht_1.kadDHT)({
        // DHT options
        }),
    },
});
var peerId = (0, peer_id_1.peerIdFromString)("QmFoo");
var peerInfo = await node.peerRouting.findPeer(peerId);
console.info(peerInfo); // peer id, multiaddrs
