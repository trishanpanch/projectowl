# Project Owl - Deployment Guide

## 1. Prerequisites
- **Google Chrome** (Version 88+)
- **Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/))
- **Developer Mode** enabled in Chrome

## 2. Configuration
Before installing, you must configure the API key.

1.  Locate `config.js` in the root directory.
2.  If it doesn't exist, create it with the following content:
    ```javascript
    const CONFIG = {
      API_KEY: 'YOUR_GEMINI_API_KEY_HERE'
    };
    ```
3.  **Security Note**: Do not commit `config.js` to public repositories. It is already added to `.gitignore`.

## 3. Installation (Local)
1.  Open Chrome and go to `chrome://extensions/`.
2.  Enable **Developer mode** in the top right.
3.  Click **Load unpacked**.
4.  Select the `Project Owl Child Safety Extension` folder.

## 4. Production Deployment (Chrome Web Store)
To publish this extension to the store for other parents:

1.  **Zip the Package**:
    -   Select all files *except* `.git`, `.gitignore`, and `node_modules`.
    -   Create a zip archive.

2.  **Store Listing**:
    -   Create a Developer Account ($5 fee).
    -   Upload the `.zip` file.
    -   Upload the generated screenshots and icons.

3.  **Privacy Policy**:
    -   You MUST provide a Privacy Policy URL.
    -   **Key Clause**: "This extension analyzes visual content locally or via a secure API. No images are permanently stored on external servers. All analysis history is stored locally on the user's device."

## 5. Enterprise / School Deployment
For deploying to managed Chromebooks:
1.  Upload to the Chrome Web Store as "Private" or "Unlisted".
2.  Use the Google Admin Console to force-install the extension ID to the target Organizational Unit (OU).
3.  **API Key Management**: For managed devices, modify `background.js` to read the API key from `chrome.storage.managed` instead of `config.js`.

## 6. Updating the Backend
If you modify the Cloud Functions (e.g., changing the `generateDailyReport` logic):
```bash
firebase deploy --only functions
```

## 7. Deploying the Dashboard
To update the live dashboard:
1.  Build the web app:
    ```bash
    cd dashboard-web
    npm run build
    ```
2.  Deploy to Firebase:
    ```bash
    firebase deploy --only hosting
    ```

## 8. Troubleshooting
-   **"Could not load config.js"**: Ensure the file exists and is valid JavaScript.
-   **"Analysis Failed"**: Check your API Key quota and internet connection.
-   **"Pin Forgotten"**: Clear the extension data (Remove and Re-install) to reset the PIN.
-   **"Report Generation Failed"**: Ensure the `generateDailyReport` function is deployed and the `GEMINI_API_KEY` secret is set.

