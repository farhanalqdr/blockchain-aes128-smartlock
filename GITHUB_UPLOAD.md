# First safe upload to GitHub

## Before you publish

1. **Rotate** any original credentials present in the source archive: Polygon private keys,
   AES shared key, RPC/Alchemy token, JWT secret and legacy RSA private key.
2. Work from this cleaned folder, **not** the original `.rar` extraction.
3. Keep `.env` and machine-local secrets **outside** Git. Only `.env.example` is tracked.
4. Review `git status` and the staged filenames before your first commit.

## Create an empty repository on GitHub

Choose **Private** until you have inspected the repository. Do not pre-create
README, `.gitignore`, or a license there; these files are already managed here.

## PowerShell or Git Bash (from this directory)

```sh
git init
git branch -M main
git add .
git diff --cached --name-only
# Carefully inspect the filename list before proceeding.
git commit -m "Initial commit: AES-128-GCM blockchain smart lock"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If Git reports that `origin` already exists, run `git remote -v` and use
`git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git` only when appropriate.

For subsequent changes:

```sh
git add .
git commit -m "Describe the changes"
git push
```

Do not push if `git diff --cached --name-only` shows `.env`, private keys,
logs containing command data, or other secrets. If secrets have already been
committed anywhere, removing them in a later commit is **not sufficient**;
rotate credentials and clean repository history before sharing.
