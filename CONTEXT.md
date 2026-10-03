# Game World

This context defines the language used to describe the command-driven game world.

## Language

**Room**:
A discrete game area that can be entered and revisited. It is represented through a directory-like command path.
_Avoid_: Folder, level (when referring to the loaded area)

**World Object**:
An entity that exists in a room and has metadata and runtime state. It is not a literal file, and some of its metadata is not exposed through player commands.
_Avoid_: File

**Virtual Path**:
A command-facing address that resolves to a room or world object inside the game.
_Avoid_: File path, filesystem path (when referring to the host computer)

**Process Definition**:
A reusable description of a behavior that a world object's rules may select.
_Avoid_: Process (when referring to a reusable description)

**Process Instance**:
One runtime execution of a process definition, associated with a world object and having its own lifecycle.
_Avoid_: Process definition

**Behavior Rule**:
A condition associated with a world object that selects a process definition.
_Avoid_: File content (when referring to the rule itself)

**Command**:
An implemented, allow-listed operation that a player submits to affect or inspect the game world.
_Avoid_: Shell command (when referring to execution on the host computer)

**Command History**:
The raw command text the player has submitted.
_Avoid_: Command result log

**Command Feedback**:
A result shown in the game view, either attached to a specific world object or shown as a general message.
_Avoid_: Terminal output
