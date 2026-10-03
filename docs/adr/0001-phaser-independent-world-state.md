# Keep world state independent from Phaser

The game needs world objects and process state to advance continuously while also responding to commands and being serializable. We decided that plain TypeScript domain state is authoritative and Phaser Game Objects are presentation adapters, with one `GameScene` coordinating both. This requires explicit mapping from domain IDs to views, but avoids coupling game rules and saved state to Phaser's display-list lifecycle.
