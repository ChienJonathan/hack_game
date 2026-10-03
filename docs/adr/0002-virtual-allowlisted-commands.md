# Route commands through a virtual allow-list

The game uses file-system-like command language to operate on world objects, but those objects are not operating-system files. We decided to parse a small command language, resolve names and paths against the game world, and execute only registered handlers. This preserves the game's command metaphor while keeping the host shell and its filesystem outside the game boundary.
