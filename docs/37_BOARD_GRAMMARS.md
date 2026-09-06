# Board grammar architecture

The block system is a pure compiler registry consumed by the teacher panel. A request is `(grammar, source, options)` and returns bounded `elements`, optional `BinaryFiles`, warnings, and the original source/options. The board owns placement, Excalidraw ID generation, persistence, and socket publication.

Native primitives are preferred because they remain selectable and editable in Excalidraw. Code and math use escaped SVG files because syntax highlighting and equation layout are presentation-oriented. Unsupported Mermaid variants intentionally use the same safe image fallback and emit a warning.

The socket board envelope carries files only when non-empty. Files are registered before applying a remote scene. A block line pointer uses `block:highlight`, is teacher-only and room-scoped, is schema validated, and is broadcast volatile so it never increments `boardVersion` or enters Convex.

Step reveal inserts a bounded prefix of compiled elements and replaces that prefix with progressively larger prefixes on teacher action. This uses normal board updates so students receive the same visible steps and reconnects bootstrap the current revealed state.

All limits are enforced before a socket emit: 12,000 source bytes, 500 elements, 900 KB serialized scene, and 2 MB binary files. The compiler never evaluates user source and all SVG text is escaped.
