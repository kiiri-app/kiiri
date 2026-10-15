# Security policy

Kiiri can see your screen, run hooks for your coding agents, and exposes a local control bridge, so we take security reports seriously.

## Reporting a vulnerability

Please **don't open a public issue.** Use [GitHub private vulnerability reporting](https://github.com/kiiri-app/kiiri/security/advisories/new) or email **security@kiiri.app**.

Include what you found, how to reproduce it, and the version and OS. We'll reply within 3 working days and keep you updated until it's fixed. We're happy to credit you.

## Supported versions

Only the latest release gets security fixes. Kiiri auto-updates, so please stay current.

## Scope

Especially interesting:
- The local bridge (`127.0.0.1:23456`) and its token check
- The MCP server and agent hooks
- Anything that could leak screenshots, API keys or file paths
- The file-creation sandbox (`~/Documents/Kiri/`) and undo
