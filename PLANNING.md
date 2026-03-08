# Refactoring Plan

## Goal
Make the codebase clean, typed, and structured before adding new features.

## Issues Identified

### 1. Type Safety
- **14 instances of `as any`** across plugin.ts, app.tsx, plugin.network.ts, app.network.tsx
- Networker library calls are completely untyped
- Message handlers bypass TypeScript type checking

### 2. Code Duplication
- Message types defined in **both** `types.ts` AND `messages.ts`
- Same type definitions in two places = maintenance burden

### 3. Unused Code
- `networkSides.ts` defines unused handlers: `ping()`, `hello()`, `createRect()`, `exportSelection()`
- These are never called or implemented

### 4. Architecture Issues
- Message passing lacks proper abstraction
- Direct channel access with type casts everywhere
- No centralized messaging service

## Tasks

### Phase 1: Fix Type Definitions
- [ ] Remove duplicate message types from `types.ts`
- [ ] Keep only `messages.ts` as the single source of truth for message types
- [ ] Update all imports to use `@core/messages`

### Phase 2: Create Typed Messaging Layer
- [ ] Create `src/plugin/messaging.ts` - typed plugin-side message service
- [ ] Create `src/ui/messaging.ts` - typed UI-side message service
- [ ] Both services export typed `send()` and `subscribe()` functions
- [ ] Remove all `as any` casts from message code

### Phase 3: Clean Up Network Configuration
- [ ] Remove unused handlers from `networkSides.ts`
- [ ] Simplify to only include `message` channel
- [ ] Update network files to use new typed messaging services

### Phase 4: Refactor Plugin Code
- [ ] Replace `(PLUGIN_CHANNEL as any).emit()` with typed `sendToUI()`
- [ ] Replace `(PLUGIN_CHANNEL as any).subscribe()` with typed `onUIMessage()`
- [ ] Update `plugin.ts` to use new messaging API

### Phase 5: Refactor UI Code
- [ ] Replace `(UI_CHANNEL as any).emit()` with typed `sendToPlugin()`
- [ ] Replace `(UI_CHANNEL as any).subscribe()` with typed `onPluginMessage()`
- [ ] Update `app.tsx` to use new messaging API

### Phase 6: Verification
- [ ] Run TypeScript compiler - ensure zero errors
- [ ] Verify no `as any` remains in messaging code
- [ ] Check all message handlers are properly typed
- [ ] Test basic plugin functionality (import, apply, save)

## Success Criteria
- Zero type casts in messaging code
- Single source of truth for message types
- No unused code in network configuration
- Full TypeScript type safety throughout
- Cleaner, more maintainable message passing architecture
