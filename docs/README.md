# Architecture documentation

These diagrams describe the implemented application. GitHub renders the Mermaid blocks directly; in an editor, use a Markdown preview with Mermaid support.

| Guide                     | What it explains                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Whole system](system.md) | Browser, frontend delivery, API, MongoDB, trust boundaries, and the authentication lifecycle.         |
| [Frontend](frontend.md)   | Routing, feature modules, native forms, TanStack Query, HTTP calls, and styling ownership.            |
| [Backend](backend.md)     | Nest modules, request processing, validation, authentication, persistence, and shared infrastructure. |

Start with the whole-system diagram, then follow the source links in each guide. Arrows show the interaction or dependency named on the arrow; these are architectural views rather than exhaustive call graphs.

For installation, commands, API examples, environment values, and verification results, return to the [project README](../README.md). For assistance and engineering decisions, see [AI.md](../AI.md).
