# Gemini Project Context

## Overview
This project appears to be a Chrome Extension (based on `manifest.json` and the `src` structure) built with React, Vite, and Tailwind CSS. It seems to focus on tab and workspace management.

## Tech Stack
- **Frontend:** React, Tailwind CSS, Lucide React (likely, based on common patterns)
- **Build Tool:** Vite
- **Extension Framework:** Standard Chrome Extension manifest v3 (likely)

## Project Structure
- `src/background/`: Background scripts for the extension.
- `src/content/`: Content scripts.
- `src/popup/`: The popup UI when the extension icon is clicked.
- `src/newtab/`: Custom new tab page.
- `src/components/`: Reusable UI components.
- `src/utils/`: Utility functions for storage, tabs, and workspaces.
- `public/icons/`: Extension icons.

## Key Files
- `manifest.json`: Extension configuration.
- `package.json`: Project dependencies and scripts.
- `tailwind.config.js` & `postcss.config.js`: CSS configuration.
- `vite.config.js`: Vite build configuration.
