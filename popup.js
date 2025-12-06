import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { CONFIG } from './src/config.js';

// Initialize Firebase (for Auth)
const app = initializeApp(CONFIG.FIREBASE);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already linked
    const data = await chrome.storage.local.get(['user_email', 'user_uid']);
    updateUI(data.user_email);

    // Refresh Button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        chrome.runtime.reload();
        window.close();
    });

    // Link Account Button
    document.getElementById('linkAccountBtn').addEventListener('click', () => {
        const section = document.getElementById('loginSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });

    // Manual Link Button
    document.getElementById('manualLinkBtn').addEventListener('click', async () => {
        const uid = document.getElementById('uidInput').value.trim();
        const errorMsg = document.getElementById('loginError');

        if (!uid) {
            errorMsg.textContent = "Please paste a valid User ID.";
            errorMsg.style.display = 'block';
            return;
        }

        try {
            // Save to Storage
            await chrome.storage.local.set({
                'user_email': 'Linked via ID', // We don't have email, but that's fine
                'user_uid': uid
            });

            updateUI('Linked Account');
            document.getElementById('loginSection').style.display = 'none';
            alert('Successfully Linked!');

        } catch (error) {
            console.error(error);
            errorMsg.textContent = "Linking failed: " + error.message;
            errorMsg.style.display = 'block';
        }
    });
    // Load Snapshot Data
    const snapshotData = await chrome.storage.local.get(['latest_snapshot', 'latest_error', 'latest_debug_info']);

    if (snapshotData.latest_error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.padding = '10px';
        errorDiv.textContent = "Error: " + snapshotData.latest_error;
        document.body.prepend(errorDiv);
    } else if (snapshotData.latest_debug_info) {
        const debugDiv = document.createElement('div');
        debugDiv.style.color = 'green';
        debugDiv.style.fontSize = '12px';
        debugDiv.style.padding = '10px';
        debugDiv.textContent = snapshotData.latest_debug_info;
        document.body.prepend(debugDiv);
    }

    if (snapshotData.latest_snapshot) {
        renderSnapshot(snapshotData.latest_snapshot);
    }
});

function updateUI(email) {
    const statusEl = document.getElementById('accountStatus');
    const linkBtn = document.getElementById('linkAccountBtn');
    const unlinkBtn = document.getElementById('unlinkBtn');

    if (email) {
        statusEl.textContent = email;
        statusEl.style.color = '#10b981';
        linkBtn.style.display = 'none'; // Hide Link button
        unlinkBtn.style.display = 'block'; // Show Unlink button
    } else {
        statusEl.textContent = 'Not Linked';
        statusEl.style.color = '#9ca3af';
        linkBtn.style.display = 'block'; // Show Link button
        linkBtn.textContent = '🔗 Link Parent Account';
        linkBtn.disabled = false;
        linkBtn.style.opacity = '1';
        unlinkBtn.style.display = 'none'; // Hide Unlink button
    }
}

document.getElementById('unlinkBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['user_email', 'user_uid']);
    updateUI(null);
    alert('Account Unlinked.');
});

document.getElementById('testConnBtn').addEventListener('click', async () => {
    const btn = document.getElementById('testConnBtn');
    const msgDiv = document.getElementById('connectionStatus') || document.createElement('div');
    msgDiv.id = 'connectionStatus';
    msgDiv.style.marginTop = '8px';
    msgDiv.style.fontSize = '12px';
    msgDiv.style.padding = '8px';
    msgDiv.style.borderRadius = '4px';
    if (!document.getElementById('connectionStatus')) {
        btn.parentNode.insertBefore(msgDiv, btn.nextSibling);
    }

    btn.textContent = 'Testing...';
    btn.disabled = true;
    msgDiv.style.display = 'none';

    try {
        // 1. Ping Check
        try {
            const ping = await chrome.runtime.sendMessage({ action: 'ping' });
            if (!ping || ping.status !== 'pong') throw new Error("Ping failed");
        } catch (pingError) {
            throw new Error(`Background Script Unreachable (Crashed?). Error: ${pingError.message}`);
        }

        // 2. Connection Test
        const response = await chrome.runtime.sendMessage({ action: 'testConnection' });
        msgDiv.style.display = 'block';

        if (response && response.success) {
            msgDiv.textContent = `✅ Success! Method: ${response.method}`;
            msgDiv.style.backgroundColor = '#d1fae5';
            msgDiv.style.color = '#065f46';
        } else {
            msgDiv.textContent = `❌ Failed: ${response ? response.error : 'Unknown Error'}`;
            msgDiv.style.backgroundColor = '#fee2e2';
            msgDiv.style.color = '#991b1b';
        }
    } catch (e) {
        msgDiv.style.display = 'block';
        msgDiv.textContent = `❌ Error: ${e.message}`;
        msgDiv.style.backgroundColor = '#fee2e2';
        msgDiv.style.color = '#991b1b';
    } finally {
        btn.textContent = '📡 Test Cloud Connection';
        btn.disabled = false;
    }
});

function renderSnapshot(snapshot) {
    const section = document.getElementById('analysis-section');
    section.style.display = 'block';

    const time = new Date(snapshot.timestamp).toLocaleTimeString();
    document.getElementById('timestamp').textContent = time; // Fixed ID
    document.getElementById('url').textContent = new URL(snapshot.url).hostname; // Fixed ID

    if (snapshot.analysis) {
        document.getElementById('score').textContent = snapshot.analysis.ad_pressure_score + '/100';

        const risk = snapshot.analysis.risk_level;
        const riskEl = document.getElementById('risk');
        riskEl.textContent = risk;
        riskEl.style.backgroundColor = getRiskColor(risk);
        riskEl.style.color = 'white';

        document.getElementById('summary').textContent = snapshot.analysis.summary_for_parent;

        const threatsList = document.getElementById('threats');
        threatsList.innerHTML = '';
        if (snapshot.analysis.detected_threats) {
            snapshot.analysis.detected_threats.forEach(t => {
                const li = document.createElement('li');
                li.textContent = t.type;
                threatsList.appendChild(li);
            });
        }
    }
}

function getRiskColor(level) {
    switch (level.toLowerCase()) {
        case 'high': return '#ef4444';
        case 'medium': return '#f59e0b';
        case 'low': return '#10b981';
        default: return '#6b7280';
    }
}
