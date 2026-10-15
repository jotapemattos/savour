## Agent skills

This project is configured for the ship-it pipeline.
Role config lives in docs/agents/ (tracker, labels, reviewer, notifier, validation).
Skills must read it instead of asking. Learned project rules are written back there.
Conversation language: en (source of truth: docs/agents/language.md).

## Guidelines

This project is built the rat-stack way: https://ratstack.sh/llms.txt. Its rules and skills are the source of truth.

Before changing code, `search` the rat-stack corpus (MCP `https://ratstack.sh/mcp`), then `read` the rule and skill that cover the change and follow them.

- Use Effect for the hard parts. Declare expected failures in the types, never turn a crash into a success, and supply dependencies through Layers.
- Declare infrastructure with Alchemy in TypeScript, and review the plan before applying it.
- Rely on the fence: compiler checks, lint rules and hooks reject banned code. Never bypass them, and keep `debt.md` escape counts from growing.
- Write no code comments. Names, types, tests and boundaries carry the meaning.
- Use one schema-typed contract and one handler per capability for every surface (CLI, HTTP, MCP).
- Keep ports in core and adapters outside it.
- XState owns lifecycle states, and Effect actors own side effects.
- Responses tell agents what to do next (HATEOAS).
- Pin dependencies to exact versions.

Skills: `add-a-capability`, `add-a-lifecycle-machine`, `add-a-store`, `learn-alchemy`, `test-behaviour`, `uncomplect`, `investigate-a-failure`, `ship`.
