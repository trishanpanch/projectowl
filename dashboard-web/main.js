import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// State
let currentUser = null;
let historyData = [];
let currentIndex = 0;
let isPlaying = false;
let unsubscribeHistory = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainDashboard = document.getElementById('mainDashboard');
const userEmailSpan = document.getElementById('userEmail');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// --- Auth Logic ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        userEmailSpan.textContent = user.email;

        // Show User ID for Linking
        const uidDisplay = document.createElement('div');
        uidDisplay.style.fontSize = '12px';
        uidDisplay.style.color = '#9ca3af';
        uidDisplay.style.marginTop = '4px';
        uidDisplay.innerHTML = `User ID: <code style="background:#374151; padding:2px 4px; border-radius:4px; user-select:all; cursor:pointer;" title="Click to Copy">${user.uid}</code>`;
        uidDisplay.querySelector('code').onclick = (e) => {
            navigator.clipboard.writeText(user.uid);
            alert('User ID copied! Paste this into the Project Owl extension.');
        };
        userEmailSpan.appendChild(uidDisplay);

        loginScreen.style.display = 'none';

        // Load Data
        subscribeToHistory();
        loadSettings();
    } else {
        // User is signed out
        currentUser = null;
        loginScreen.style.display = 'flex';
        userEmailSpan.textContent = '';

        // Unsubscribe
        if (unsubscribeHistory) unsubscribeHistory();
    }
});

loginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed: " + error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- Firestore Logic ---

function subscribeToHistory() {
    if (!currentUser) return;

    const historyRef = collection(db, "users", currentUser.uid, "history");
    const q = query(historyRef, orderBy("timestamp", "desc"), limit(50));

    unsubscribeHistory = onSnapshot(q, (snapshot) => {
        historyData = [];
        snapshot.forEach((doc) => {
            historyData.push({ id: doc.id, ...doc.data() });
        });

        // Convert timestamps to ISO string if they are Firestore Timestamps
        historyData = historyData.map(item => {
            if (item.timestamp && item.timestamp.toDate) {
                return { ...item, timestamp: item.timestamp.toDate().toISOString() };
            }
            return item;
        });

        renderSidebar();
    });
}

// --- Settings Logic ---

async function loadSettings() {
    if (!currentUser) return;

    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        const settings = data.settings || {
            influencers: true,
            urgency: true,
            ads: true,
            lootboxes: true,
            custom_prompt: ""
        };
        const safeList = data.safe_list || [];

        // Update UI
        document.getElementById('setting_influencers').checked = settings.influencers;
        document.getElementById('setting_urgency').checked = settings.urgency;
        document.getElementById('setting_ads').checked = settings.ads;
        document.getElementById('setting_lootboxes').checked = settings.lootboxes;
        document.getElementById('setting_custom_prompt').value = settings.custom_prompt || "";

        renderSafeList(safeList);
    }
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    if (!currentUser) return;

    const settings = {
        influencers: document.getElementById('setting_influencers').checked,
        urgency: document.getElementById('setting_urgency').checked,
        ads: document.getElementById('setting_ads').checked,
        lootboxes: document.getElementById('setting_lootboxes').checked,
        custom_prompt: document.getElementById('setting_custom_prompt').value.trim()
    };

    // Save to Firestore
    await setDoc(doc(db, "users", currentUser.uid), {
        settings: settings,
        safe_list: currentSafeList
    }, { merge: true });

    document.getElementById('settingsModal').style.display = 'none';
    alert('Settings saved to cloud!');
});

// --- UI Logic (Reel, Sidebar, etc.) ---

// Safe List Logic
let currentSafeList = [];

function renderSafeList(list) {
    currentSafeList = list;
    const container = document.getElementById('safeListContainer');
    container.innerHTML = '';

    list.forEach(domain => {
        const tag = document.createElement('div');
        tag.style.cssText = 'background: #374151; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 6px;';
        tag.innerHTML = `
            ${domain}
            <span style="cursor: pointer; color: #9ca3af;" onclick="window.removeFromSafeList('${domain}')">&times;</span>
        `;
        container.appendChild(tag);
    });
}

window.removeFromSafeList = (domain) => {
    currentSafeList = currentSafeList.filter(d => d !== domain);
    renderSafeList(currentSafeList);
};

document.getElementById('addSafeDomainBtn').addEventListener('click', () => {
    const input = document.getElementById('safeListInput');
    const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (domain && !currentSafeList.includes(domain)) {
        currentSafeList.push(domain);
        renderSafeList(currentSafeList);
        input.value = '';
    }
});

// Settings Modal
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'flex';
});

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
});

// Sidebar & Reel
function renderSidebar() {
    const list = document.getElementById('eventList');
    list.innerHTML = '';

    if (historyData.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #6b7280; margin-top: 20px;">No events recorded today.</div>';
        return;
    }

    // History is already sorted desc by Firestore, but for sidebar we want newest at top (which it is)
    historyData.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'event-item';

        const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const risk = item.analysis ? item.analysis.risk_level : 'Unknown';
        const riskColor = getRiskColor(risk);

        el.innerHTML = `
      <div class="event-time">${time}</div>
      <div style="font-weight: 500; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${new URL(item.url).hostname}</div>
      <div class="event-risk" style="color: ${riskColor}; border: 1px solid ${riskColor}">${risk}</div>
    `;

        el.addEventListener('click', () => showEvent(index));
        list.appendChild(el);
    });
}

function showEvent(index) {
    currentIndex = index;
    const item = historyData[index];

    // Update UI
    document.getElementById('emptyState').style.display = 'none';

    const img = document.getElementById('reelImage');
    // Note: We are not storing full image data in Firestore for cost reasons in the new model?
    // Wait, the previous implementation DID store imageData in Firestore?
    // Let's check functions/index.js.
    // "Note: We do NOT store the full image to save cost/storage, just the metadata"
    // Ah! So the dashboard won't show the image unless we change that.
    // For MVP, if we want the Reel to work, we MUST store the image or a thumbnail.
    // Since the user wants the Reel, I should update the Cloud Function to store the image (base64) for now, or use Storage.
    // For now, let's assume the image IS there or handle the missing image gracefully.

    if (item.imageData) {
        img.src = item.imageData;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
        // Maybe show a placeholder?
    }

    const overlay = document.getElementById('reelOverlay');
    overlay.style.display = 'block';

    const riskBadge = document.getElementById('reelRisk');
    if (item.analysis) {
        riskBadge.textContent = item.analysis.risk_level + ' RISK';
        riskBadge.className = `risk-badge risk-${item.analysis.risk_level.toLowerCase()}`;
        riskBadge.style.display = 'block';

        document.getElementById('reelTitle').textContent = `Ad-Pressure: ${item.analysis.ad_pressure_score}/100`;
        document.getElementById('reelDesc').textContent = item.analysis.summary_for_parent;
    } else {
        riskBadge.style.display = 'none';
        document.getElementById('reelTitle').textContent = 'Processing...';
        document.getElementById('reelDesc').textContent = 'Analysis not available yet.';
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

// Reel Playback
document.getElementById('playReelBtn').addEventListener('click', async () => {
    if (isPlaying) return;
    isPlaying = true;
    const btn = document.getElementById('playReelBtn');
    btn.textContent = 'Playing...';
    btn.disabled = true;

    // Filter for "interesting" events
    let playlist = historyData.map((item, index) => ({ item, index }));
    const highRisk = playlist.filter(p => p.item.analysis && (p.item.analysis.risk_level === 'High' || p.item.analysis.risk_level === 'Medium'));

    if (highRisk.length > 0) {
        playlist = highRisk;
    }

    // Reverse for playback (oldest to newest)? Or newest to oldest?
    // Usually a reel is chronological. historyData is Newest First.
    // So we should reverse it to play Oldest -> Newest.
    playlist.reverse();

    for (const entry of playlist) {
        showEvent(entry.index);
        await new Promise(r => setTimeout(r, 5000));
    }

    isPlaying = false;
    btn.textContent = '▶ Play Daily Reel';
    btn.disabled = false;
});

document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all history?')) {
        // In Firestore, we'd need to delete the collection. 
        // For MVP, maybe just warn it's not implemented or do a batch delete.
        alert("Clearing cloud history is not yet implemented in this version.");
    }
});

// --- Report Generation ---

document.getElementById('requestReportBtn').addEventListener('click', async () => {
    document.getElementById('mainDashboard').style.display = 'none';
    document.getElementById('reportView').style.display = 'flex';
    const reportContentDiv = document.getElementById('reportContent');
    const downloadBtn = document.getElementById('downloadReportBtn');
    downloadBtn.style.display = 'none';

    // Progress Bar UI
    reportContentDiv.innerHTML = `
        <div style="text-align: center; color: #9ca3af; padding: 40px;">
            <div style="font-size: 40px; margin-bottom: 24px;">👩‍⚕️</div>
            <h3 style="color: white; margin-bottom: 16px;">Dr. Owl is analyzing your child's day...</h3>
            
            <div style="background: #374151; height: 8px; border-radius: 4px; width: 100%; max-width: 400px; margin: 0 auto 16px; overflow: hidden;">
                <div id="reportProgressBar" style="background: var(--primary); height: 100%; width: 0%; transition: width 0.5s;"></div>
            </div>
            
            <div id="reportProgressText" style="font-size: 14px; color: var(--text-muted);">Initializing...</div>
        </div>
    `;

    const progressBar = document.getElementById('reportProgressBar');
    const progressText = document.getElementById('reportProgressText');

    // Simulate Progress
    let progress = 2;
    progressBar.style.width = '2%';

    const interval = setInterval(() => {
        // Increment faster at first, then slower
        const increment = (90 - progress) / 20;
        progress += Math.max(0.5, increment);

        if (progress > 95) progress = 95;

        progressBar.style.width = `${progress}%`;

        if (progress < 30) progressText.textContent = `Scanning ${historyData.length} events...`;
        else if (progress < 60) progressText.textContent = "Identifying potential risks...";
        else if (progress < 80) progressText.textContent = "Consulting Dr. Owl's safety guidelines...";
        else progressText.textContent = "Finalizing your wellness report...";

    }, 200);

    try {
        const generateDailyReport = httpsCallable(functions, 'generateDailyReport');
        // Actual API Call
        const result = await generateDailyReport({ history: historyData });

        // Complete Progress
        clearInterval(interval);
        progressBar.style.width = '100%';
        progressText.textContent = "Done!";

        // Small delay to show 100%
        setTimeout(() => {
            reportContentDiv.textContent = result.data.report;
            downloadBtn.style.display = 'inline-block';
        }, 500);

    } catch (e) {
        clearInterval(interval);
        console.error(e);
        reportContentDiv.innerHTML = `<p style="color: var(--danger); text-align: center;">Failed to generate report: ${e.message}</p>`;
    }
});

document.getElementById('downloadReportBtn').addEventListener('click', () => {
    const text = document.getElementById('reportContent').textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project_Owl_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
});

document.getElementById('closeReportBtn').addEventListener('click', () => {
    document.getElementById('reportView').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'flex';
});
// --- Debugging ---

const debugBtn = document.createElement('button');
debugBtn.textContent = '🐞 Debug System';
debugBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.2);';
document.body.appendChild(debugBtn);

debugBtn.addEventListener('click', async () => {
    if (!currentUser) return alert("Please sign in first.");

    debugBtn.textContent = 'Running Tests...';
    debugBtn.disabled = true;
    let report = "Debug Report:\n";

    try {
        // Test 1: Direct Firestore Write
        const testRef = doc(collection(db, "users", currentUser.uid, "history"));
        await setDoc(testRef, {
            timestamp: new Date().toISOString(), // Use string for client-side write compatibility
            url: "https://debug-test.com",
            analysis: {
                risk_level: "Low",
                ad_pressure_score: 0,
                summary_for_parent: "Debug Test: Direct Firestore Write Successful.",
                detected_threats: []
            }
        });
        report += "✅ Test 1: Direct Firestore Write - SUCCESS\n";
    } catch (e) {
        report += `❌ Test 1: Direct Firestore Write - FAILED (${e.message})\n`;
    }

    try {
        // Test 2: Cloud Function Call
        const analyzeImage = httpsCallable(functions, 'analyzeImage');
        // Send a 1x1 pixel transparent gif base64
        const dummyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        await analyzeImage({
            imageData: dummyImage,
            url: "https://cloud-function-test.com",
            uid: currentUser.uid,
            settings: {}
        });
        report += "✅ Test 2: Cloud Function Call - SUCCESS\n";
    } catch (e) {
        report += `❌ Test 2: Cloud Function Call - FAILED (${e.message})\n`;
    }

    alert(report);
    debugBtn.textContent = '🐞 Debug System';
    debugBtn.disabled = false;
});
