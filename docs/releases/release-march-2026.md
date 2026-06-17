---
title: Release Notes - March 2026
parent: Release Notes
---

# Release Notes - March 2026

We rolled out several interface upgrades and performance foundations during March.

## Major Highlights

### 1. PWA Prototype
- Built the initial framework for Progressive Web App (PWA) support.
- Configured baseline service worker shells to lay the foundation for complete offline caching and mobile-app-like installation behavior.

### 2. Theme Engine
- Integrated a custom theme builder and engine.
- Supports light mode, dark mode, and specific corporate palettes (e.g., custom colors).
- Fixed captain page colors and eliminated layout bugs.

### 3. Client-Side Logo Compression
- Uploading large logos could cause server overhead and sluggish loading.
- Implemented client-side canvas compression for all logo uploads, ensuring images are resized and optimized before hitting database storage.
