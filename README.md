# Project Owl - Child Safety Agent

## Overview
Project Owl is a browser-based agent that uses computer vision to protect children from modern online threats. It captures visual snapshots of the browsing experience and analyzes them for "soft threats" like aggressive marketing, dark patterns, and inappropriate content.

## Features
- **🧠 Smart Sampling Engine**: Captures screen activity every second but only analyzes significant changes (>5% visual difference) to save costs.
- **🛡️ Secure Cloud Backend**: Uses Firebase Cloud Functions to proxy AI calls, keeping API keys secure and hidden from the client.
- **👁️ AI Threat Detection**: Analyzes content for "soft threats" using Google Gemini 1.5 Flash:
  - **Ad-Pressure**: Detects aggressive marketing and clutter.
  - **Influencer Marketing**: Flags undisclosed sponsorships.
  - **Dark Patterns**: Identifies fake urgency (countdowns) and manipulative UI.
  - **Loot Boxes**: Detects gambling-like mechanics in games.
- **📊 Parent Dashboard**:
  - **Daily Reel**: Visual playback of the day's flagged events.
  - **Custom Safety Instructions**: Parents can add specific text prompts (e.g., "Flag Fortnite V-Bucks") to customize the AI's detection.
  - **Daily Digital Wellness Report**: Generates a professional summary of the day's activity using a "Child Psychologist" persona (Dr. Owl), offering conversation starters and safety insights.
- **🔒 Privacy First**:
  - PIN-protected dashboard.
  - Data stored in secure Firestore database (user-isolated).
  - Images processed in memory or securely logged (metadata only).

## Setup & Installation

### 1. Prerequisites
-   Node.js (v20+)
-   Firebase CLI (`npm install -g firebase-tools`)
-   Google Chrome

### 2. Backend Setup
Follow `BACKEND_SETUP.md` to create your Firebase project and deploy the Cloud Functions.

### 3. Chrome Extension Setup
1.  **Install Dependencies & Build**:
    ```bash
    npm install
    node build.js
    ```
2.  **Load in Chrome**:
    -   Go to `chrome://extensions/`.
    -   Enable **Developer mode**.
    -   Click **Load unpacked**.
    -   Select this root project folder.

### 4. Dashboard Web App
**Live URL**: [https://projectowl-22baa.web.app](https://projectowl-22baa.web.app)

You can access the dashboard from any device using the link above.

## How to Run (Daily Usage)

### 1. Access the Dashboard
Go to [https://projectowl-22baa.web.app](https://projectowl-22baa.web.app) and sign in.

### 2. Link the Extension
1.  Open Chrome on the device you want to monitor.
2.  Click the **Project Owl** extension icon.
3.  Click **Link Parent Account**.
4.  **Copy your User ID** from the Dashboard (top right corner, under your email).
5.  **Paste** the ID into the extension and click **Link Account**.
6.  Status should change to **Active Monitoring**.

## Architecture
-   **Frontend (Extension)**: Chrome Extension (Manifest V3), Vanilla JS, OffscreenCanvas.
-   **Frontend (Dashboard)**: Vite + Vanilla JS Web App (Firebase Auth + Firestore).
-   **Backend**: Firebase Cloud Functions (Node.js 20).
-   **Database**: Firestore (for history and settings).
-   **AI**: Google Gemini 1.5 Flash.
