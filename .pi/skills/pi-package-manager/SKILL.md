---
name: pi-package-manager
description: Manage pi-packages in the 0xKobold monorepo. Use when creating new packages, syncing with individual repos, publishing to npm, or checking package compliance with pi-package standards.
---

# pi-package-manager Skill

Manages the bidirectional sync between the 0xKobold monorepo and individual pi-package repos on GitHub.

## Architecture Overview

```
0xKobold Monorepo
├── packages/
│   ├── pi-learn/      ← Develop here
│   ├── pi-ollama/     ← Develop here
│   └── ...            ← All pi-packages
├── .github/workflows/
│   ├── publish.yml              ← Push monorepo → individual repos + npm
│   └── sync-from-individual.yml ← Pull individual repos → monorepo
└── scripts/
    └── sync-packages.sh         ← Manual sync script
```

## Core Workflows

### 1. Develop in Monorepo → Auto-publish to Individual Repos

**When you merge to main:**
1. CI detects changes in `packages/pi-*/`
2. Extracts package using `git subtree split`
3. Pushes to `git@github.com:0xKobold/<package>.git`
4. Publishes to npm (if version bumped)

**Files changed:** `.github/workflows/publish.yml`

### 2. External Contributions → Sync Back to Monorepo

**When someone PRs to an individual repo:**
1. CI runs hourly (cron: `0 * * * *`)
2. Fetches all individual repos
3. Uses `git subtree pull` to merge changes
4. Creates PR to monorepo for review

**Files changed:** `.github/workflows/sync-from-individual.yml`

## Common Tasks

### Check Package Status

Run this before starting any work:

```bash
# Check which packages are in the monorepo
ls packages/pi-*/package.json

# Check which have GitHub repos
for pkg in packages/pi-*/; do
  name=$(basename "$pkg")
  repo_exists=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://api.github.com/repos/0xKobold/$name")
  echo "$name: $repo_exists"
done
```

### Create a New pi-package

**Prerequisites:**
1. Package must be in `packages/pi-<name>/`
2. Must have `package.json` with:
   - `"keywords": ["pi-package"]`
   - `"pi": { "extensions": [...] }`
   - `"prepublishOnly": "rm -rf dist && tsc"` script
   - `"repository"` pointing to individual repo

**Steps:**

```bash
# 1. Create the package directory
mkdir -p packages/pi-myextension/src

# 2. Create package.json with required fields
cat > packages/pi-myextension/package.json << 'EOF'
{
  "name": "@0xkobold/pi-myextension",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/index.ts"]
  },
  "scripts": {
    "prepublishOnly": "rm -rf dist && tsc"
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": ">=0.6.0"
  }
}
EOF

# 3. Create GitHub repo (must be done on GitHub first)
gh repo create 0xKobold/pi-myextension --public

# 4. Init git and push initial commit
cd packages/pi-myextension
git init -b main
git remote add origin git@github.com:0xKobold/pi-myextension.git
git add .
git commit -m "Initial commit"
git push -u origin main
cd -

# 5. Add to sync script
# Edit scripts/sync-packages.sh and add "pi-myextension" to PACKAGES array
```

### Sync a Package Manually

Use the sync script for one-off syncs:

```bash
# Interactive sync (asks for each package)
./scripts/sync-packages.sh

# Or manually pull from individual repo
git subtree pull \
  --prefix=packages/pi-learn \
  git@github.com:0xKobold/pi-learn.git \
  main \
  --squash \
  -m "sync: pull pi-learn from individual repo"
```

### Trigger CI Sync

**To push monorepo changes to individual repos:**

```bash
# Option 1: Push to main (triggers publish.yml)
git push origin main

# Option 2: Trigger via GitHub CLI
gh workflow run publish.yml --ref main

# Option 3: Manual trigger for specific package
gh workflow run publish.yml \
  --field package=pi-learn
```

**To trigger sync from individual repos:**

```bash
# Trigger hourly sync manually
gh workflow run sync-from-individual.yml

# Or sync specific package
gh workflow run sync-from-individual.yml \
  --field package=pi-ollama
```

### Publish to npm

1. **Version bump** in the package directory:
   ```bash
   cd packages/pi-learn
   npm version patch  # or minor, major
   cd -
   git add packages/pi-learn/package.json
   git commit -m "chore: bump pi-learn to v0.x.x"
   ```

2. **Create GitHub release** (triggers npm publish):
   ```bash
   gh release create v0.x.x \
     --title "Release v0.x.x" \
     --notes "Release notes here"
   ```

3. **Or trigger publish.yml directly:**
   ```bash
   gh workflow run publish.yml
   ```

## Package Checklist

When creating or reviewing a pi-package, ensure:

- [ ] `package.json` has `"keywords": ["pi-package"]`
- [ ] `package.json` has `pi.extensions` manifest
- [ ] `package.json` has `prepublishOnly` script
- [ ] `package.json` has correct `repository` URL
- [ ] `package.json` has `peerDependencies`
- [ ] `src/index.ts` exports `default` async function
- [ ] Package builds successfully: `cd packages/<pkg> && bun run build`
- [ ] GitHub repo exists at `github.com/0xKobold/<pkg>`

## File Reference

| File | Purpose |
|------|---------|
| `.github/workflows/publish.yml` | Push monorepo → individual + npm |
| `.github/workflows/sync-from-individual.yml` | Pull individual → monorepo |
| `scripts/sync-packages.sh` | Manual sync helper |
| `packages/.gitignore` | Excludes node_modules/dist from commits |

## Troubleshooting

### "fatal: couldn't find remote ref refs/heads/main"

Individual repo has no `main` branch. Push to it first:

```bash
cd packages/pi-<name>
git init -b main
git remote add origin git@github.com:0xKobold/pi-<name>.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### "subtree push" failed

Check that the individual repo exists and you have access:

```bash
gh repo view 0xKobold/pi-<name>
```

### Package not publishing to npm

1. Check `NPM_TOKEN` secret is set in GitHub repo
2. Verify version was bumped (npm won't republish same version)
3. Check workflow logs at: GitHub repo → Actions → publish.yml

### Sync conflicts

If subtree pull has conflicts:

```bash
git status
# Resolve conflicts manually
git add <resolved-files>
git commit -m "resolve: sync conflicts"
# Continue the rebase/merge
git subtree pull --prefix=packages/<pkg> <remote> main --squash
```

## Best Practices

1. **Develop in monorepo** - Easier to test integrations
2. **Sync often** - Run sync script or let CI handle it
3. **Version bump before release** - Prevents npm conflicts
4. **Test before commit** - Always `bun run build` in package dir
5. **Keep package.json consistent** - Same structure across all packages
6. **Use prepublishOnly** - Prevents ghost files in npm package
