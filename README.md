# harmonic-major

A GitHub Action for automated semantic versioning and changelog generation based on conventional commits.

## Features

- 🚀 **Automatic Version Bumping**: Determines the next version based on conventional commit messages
- 📝 **Changelog Generation**: Creates detailed changelogs with proper categorization
- 🎯 **Monorepo Support**: Works with workspaces in Yarn and PNPM monorepos
- 🔄 **Git Integration**: Creates version tags and commits changes automatically
- 🧩 **Conventional Commits**: Uses commit types to determine version increments (feat → minor, fix → patch, breaking changes → major)

## Usage

Add the following to your GitHub workflow:

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Harmonic Major Release
        uses: rafael-lua/harmonic-major@v1
        with:
          # Optional: Set GitHub token for release creation
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # Optional: Set custom tag prefix (default: v)
          tag-prefix: 'v'
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `github-token` | `''` | GitHub token for creating releases |
| `tag-prefix` | `'v'` | Prefix for version tags |
| `changelog-path` | `'CHANGELOG.md'` | Path to the changelog file |
| `push` | `true` | Whether to push changes to the remote repository |
| `dry-run` | `false` | Run without making actual changes |

## How It Works

harmonic-major analyzes your commit history and determines the appropriate semantic version bump:

- `fix:` commits trigger a patch bump (0.0.x)
- `feat:` commits trigger a minor bump (0.x.0)
- Breaking changes (marked with `!` or `BREAKING CHANGE:` in the commit message) trigger a major bump (x.0.0)
- Other commits (chore, docs, style, etc.) don't trigger version bumps on their own

The action then:
1. Determines the next version
2. Updates package.json files in the repository 
3. Updates the changelog
4. Creates a git tag
5. Optionally creates a GitHub release

## Package Manager Support

Harmonic-major works with:
- Yarn
- PNPM
- npm (standard projects)

For monorepos, both Yarn workspaces and PNPM workspaces are supported.

## Todo

- [ ] Order scopes
- [ ] Undo changes on errors
- [ ] Support prereleases
- [ ] Improve logs and use `@actions/core` instead of `console`

## License

MIT