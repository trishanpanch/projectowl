# Project Owl - Backend Setup Guide

This guide explains how to set up the Firebase backend (Cloud Functions + Firestore) to secure your extension.

## 1. Create Firebase Project
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Click **Add project** and name it `project-owl-backend`.
3.  Enable **Google Analytics** (optional).
4.  Click **Create Project**.

## 2. Upgrade to Blaze Plan (Required for Cloud Functions)
1.  In the Firebase Console, go to **Usage and Billing**.
2.  Switch to the **Blaze (Pay as you go)** plan.
    *   *Note: The free tier includes 2M invocations/month, so you likely won't pay anything, but it's required to make external API calls to Gemini.*

## 3. Enable Services
1.  **Authentication**:
    -   Go to Build -> Authentication -> Get Started.
    -   Enable **Email/Password** provider.
    -   Enable **Google** provider (Required for Dashboard).
2.  **Firestore Database**:
    -   Go to Build -> Firestore Database -> Create Database.
    -   Select a region (e.g., `nam5 (us-central)`).
    -   Start in **Production mode**.
3.  **Gemini API**:
    -   Ensure the **Generative Language API** is enabled in the Google Cloud Console for this project.

## 4. Configure Firebase Auth (Crucial for Extension)
To allow "Sign in with Google" from the Chrome Extension:
1.  Go to `chrome://extensions/` and copy the **ID** of the Project Owl extension (e.g., `abcdef...`).
2.  Go to **Firebase Console** -> **Authentication** -> **Settings** -> **Authorized Domains**.
3.  Click **Add domain**.
4.  Enter: `chrome-extension://<YOUR_EXTENSION_ID>`
5.  Click **Add**.

## 5. Configure Local Environment
1.  Install Firebase CLI:
    ```bash
    npm install -g firebase-tools
    ```
2.  Login:
    ```bash
    firebase login
    ```
3.  Initialize Project:
    ```bash
    firebase use --add
    # Select your new project
    ```

## 5. Set Secrets (Secure API Key)
Instead of hardcoding the API key, we store it securely in Cloud Secret Manager.

```bash
cd functions
# This command sets the secret for the function to use
firebase functions:secrets:set GEMINI_API_KEY
# Paste your Gemini API Key when prompted
```

## 6. Deploy Backend & Dashboard
1.  **Build the Dashboard**:
    Since the dashboard is a React app, you must build it first:
    ```bash
    cd dashboard-web
    npm install
    npm run build
    cd ..
    ```
2.  **Deploy**:
    Deploy the Cloud Functions (`analyzeImage`, `drOwlChat`) and the Hosting site:
    ```bash
    firebase deploy
    ```

## 7. Connect Extension
1.  In Firebase Console, go to **Project Settings**.
2.  Scroll to "Your apps" -> Click the Web icon (`</>`).
3.  Register app "Project Owl Extension".
4.  Copy the `firebaseConfig` object.
5.  Open `src/config.js` in your local project.
6.  Replace the placeholder `FIREBASE` object with your real config.
7.  Re-build the extension:
    ```bash
    node build.js
    ```

## 8. Verification
1.  Reload the extension.
2.  The extension will now detect the valid Firebase config and switch from "Direct API" mode to "Cloud Function" mode.
3.  Check the background console logs for `Using Cloud Function...`.
