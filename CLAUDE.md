# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Package-level architecture

The two application packages each have their own architecture doc, written for an AI agent modifying that package specifically (module conventions, error handling, testing patterns, directory layout). Read the relevant one before making non-trivial changes:

- `api/ARCHITECTURE.md` — NestJS backend: module/DI conventions, `Storage` persistence pattern, auth error-mapping contract, pure-function modules (parser, date math).
- `webapp/ARCHITECTURE.md` — React SPA: Redux (classic reducers/middleware, no thunks) flow checklist, API client conventions, auth module shape, PWA setup.

Both are committed alongside the code they document — keep them in sync when conventions change, same as `AGENTS.md`.
