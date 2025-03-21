# harmonic-major Agent Guidelines

## Build/Lint/Test Commands
- Build: `yarn build`
- Lint: `yarn lint`
- Format: `yarn format`
- Test All: `yarn test`
- Run Single Test: `yarn test -t "test name pattern"`
- All Checks: `yarn all`
- Build & Commit Dist: `yarn dist`

## Code Style Guidelines
- **Formatting**: 4 spaces, no semicolons, double quotes, trailing commas
- **Imports**: Named imports, alphabetically ordered
- **Types**: Always use TypeScript types, prefer explicit types
- **Error Handling**: Throw typed errors with descriptive messages, check conditions early
- **Naming**: camelCase for functions/variables, PascalCase for types
- **Structure**: Modular design with clear separation of concerns
- **TypeScript**: Strict mode enabled with noUncheckedIndexedAccess, noImplicitOverride
- **Testing**: Use Vitest with describe/it pattern, proper setup/teardown
- **Git**: Follow conventional commits (feat, fix, chore, docs, etc.)
- **Comments**: Minimal, descriptive comments explaining "why" not "what"