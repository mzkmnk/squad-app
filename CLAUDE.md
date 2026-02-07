# CLAUDE.md

## Project Overview

SquadApp — Angular 20 + Electron 40 desktop application with type-safe IPC communication.

## Tech Stack

- **Frontend**: Angular 20 (standalone components, zoneless change detection, signals)
- **Desktop**: Electron 40 with contextBridge IPC
- **Language**: TypeScript 5.8 (strict mode)
- **Package Manager**: pnpm

## Project Structure

```
src/           # Angular application source
electron/      # Electron main process, preload script, and type definitions
public/        # Static assets
```

## Commands

```bash
pnpm install              # Install dependencies
ng serve                  # Start Angular dev server (localhost:4200)
ng test                   # Run Karma/Jasmine unit tests
pnpm build                # Production build (Angular)
pnpm electron:build       # Compile Electron TypeScript
pnpm electron:serve       # Build and launch Electron app
pnpm package              # Full production package (Angular + Electron + electron-builder)
```

## Code Style

- 2-space indentation
- Single quotes in TypeScript
- UTF-8 encoding, LF line endings
- Prettier configured for Angular HTML templates (see `package.json`)
- EditorConfig enforced (`.editorconfig`)
- No ESLint configured

## TypeScript Configuration

Strict mode is fully enabled:
- `strict`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- Angular strict templates: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`, `typeCheckHostBindings`

## Testing

- **Framework**: Karma + Jasmine
- **Run**: `ng test`
- **Test files**: co-located as `*.spec.ts` alongside source files

## Electron Architecture

- Main process: `electron/main.ts` — window creation, IPC handlers
- Preload: `electron/preload.ts` — secure `window.electronAPI` bridge via `contextBridge`
- Types: `electron/electron.d.ts` — shared IPC type definitions
- Security: `nodeIntegration: false`, `contextIsolation: true`
