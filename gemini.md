# Gemini Project Context

## Overview
This project is a Chrome Extension named **MyWorkona**, designed for tab and workspace management. It is built using **React**, **Vite**, and **Tailwind CSS**, following the Chrome Extension Manifest V3 standard.

## Tech Stack
- **Frontend:** React (JSX), Tailwind CSS
- **Icons:** Lucide React (standard for this setup)
- **Build Tool:** Vite
- **Styling:** PostCSS, Tailwind CSS
- **Extension Version:** Manifest V3

## Project Structure
- `src/background/`: Contains `background.js` for background service worker logic.
- `src/components/`: Reusable UI components (e.g., `IconRenderer.jsx`).
- `src/content/`: Content scripts (`content.js`) that interact with web pages.
- `src/newtab/`: Custom "New Tab" page implementation.
- `src/popup/`: Extension popup UI.
- `src/styles/`: Global CSS and Tailwind imports.
- `src/utils/`: Helper modules for storage, tab management, and workspaces.
- `public/icons/`: Branding and UI assets.
- `guide/`: Project documentation and guides.

## Key Files
- `manifest.json`: Extension metadata and permissions.
- `package.json`: NPM dependencies and build scripts.
- `vite.config.js`: Configuration for the Vite build pipeline.
- `tailwind.config.js` & `postcss.config.js`: Styling configuration.
- `Tab Manager UI Prototype.jsx`: A prototype file for the UI in the root.