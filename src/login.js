import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { CONFIG } from './config.js';

const app = initializeApp(CONFIG.FIREBASE);
const auth = getAuth(app);

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    const errorEl = document.getElementById('error');
    const statusEl = document.getElementById('status');
    const btn = document.getElementById('googleLoginBtn');

    errorEl.style.display = 'none';

    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Save to Extension Storage
        await chrome.storage.local.set({
            'user_email': user.email,
            'user_uid': user.uid
        });

        // UI Updates
        btn.style.display = 'none';
        statusEl.style.display = 'block';

        // Auto-close after 2 seconds
        setTimeout(() => {
            window.close();
        }, 2000);

    } catch (error) {
        console.error(error);
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';

        if (error.code === 'auth/unauthorized-domain') {
            errorEl.textContent += " (Please add chrome-extension://" + chrome.runtime.id + " to Firebase Auth Authorized Domains)";
        }
    }
});
