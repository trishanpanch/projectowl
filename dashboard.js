document.addEventListener('DOMContentLoaded', async () => {
    // Check PIN Status
    await checkPinStatus();

    document.getElementById('unlockBtn').addEventListener('click', handleUnlock);
    document.getElementById('setupPinLink').addEventListener('click', handleSetupPin);

    // Allow Enter key to unlock
    document.getElementById('pinInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUnlock();
    });

    await loadHistory();

    document.getElementById('playReelBtn').addEventListener('click', playReel);
    document.getElementById('clearBtn').addEventListener('click', clearHistory);

    // Settings Modal Logic
    const modal = document.getElementById('settingsModal');

    document.getElementById('settingsBtn').addEventListener('click', async () => {
        // Load current settings
        const data = await chrome.storage.local.get(['detection_settings', 'safe_list']);
        const settings = data.detection_settings || {
            influencers: true,
            urgency: true,
            ads: true,
            lootboxes: true
        };
        const safeList = data.safe_list || [];

        document.getElementById('setting_influencers').checked = settings.influencers;
        document.getElementById('setting_urgency').checked = settings.urgency;
        document.getElementById('setting_ads').checked = settings.ads;
        document.getElementById('setting_lootboxes').checked = settings.lootboxes;

        renderSafeList(safeList);

        modal.style.display = 'flex';
    });

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
                <span style="cursor: pointer; color: #9ca3af;" onclick="this.parentElement.remove(); removeFromSafeList('${domain}')">&times;</span>
            `;
            container.appendChild(tag);
        });
    }

    // Expose to window for inline onclick
    window.removeFromSafeList = (domain) => {
        currentSafeList = currentSafeList.filter(d => d !== domain);
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

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // --- Daily Report Logic ---

    document.getElementById('requestReportBtn').addEventListener('click', async () => {
        // 1. Switch Views
        document.getElementById('mainDashboard').style.display = 'none';
        document.getElementById('reportView').style.display = 'flex';

        const reportContentDiv = document.getElementById('reportContent');

        // 2. Check Cache
        const cacheData = await chrome.storage.local.get('daily_report_cache');
        const today = new Date().toDateString();

        if (cacheData.daily_report_cache && cacheData.daily_report_cache.date === today) {
            // Show cached report
            reportContentDiv.innerHTML = marked.parse(cacheData.daily_report_cache.content); // Assuming marked is available or use simple text
            // Fallback if marked isn't loaded:
            if (typeof marked === 'undefined') {
                reportContentDiv.textContent = cacheData.daily_report_cache.content;
            }
            return;
        }

        // 3. Generate New Report
        try {
            const data = await chrome.storage.local.get('daily_history');
            const history = data.daily_history || [];

            if (history.length === 0) {
                reportContentDiv.innerHTML = "<p style='text-align:center'>No activity recorded today yet.</p>";
                return;
            }

            // Call Cloud Function
            // Note: We need to import functions/httpsCallable if we were in a module, 
            // but dashboard.js is likely a standard script. 
            // We'll assume the Firebase SDK is available globally or we need to use the existing 'functions' var if exposed?
            // Wait, dashboard.js doesn't have Firebase initialized in the previous snippets. 
            // It relies on background.js for logic usually, but here we need to call it directly OR message background.js.
            // EASIEST: Message background.js to do the heavy lifting.

            reportContentDiv.innerHTML = `
            <div style="text-align: center; color: #9ca3af; padding: 40px;">
                <div style="font-size: 40px; margin-bottom: 16px;">👩‍⚕️</div>
                Generating report with Dr. Owl... <br>
                <span style="font-size: 12px;">(Analyzing ${history.length} events)</span>
            </div>
        `;

            // Send message to background to call Cloud Function
            const response = await chrome.runtime.sendMessage({
                action: 'generateReport',
                history: history
            });

            if (response.error) {
                throw new Error(response.error);
            }

            // Render & Cache
            const reportText = response.report;
            reportContentDiv.textContent = reportText; // Simple text render for safety first

            await chrome.storage.local.set({
                'daily_report_cache': {
                    date: today,
                    content: reportText
                }
            });

        } catch (e) {
            console.error(e);
            reportContentDiv.innerHTML = `<p style="color: var(--danger); text-align: center;">Failed to generate report: ${e.message}</p>`;
        }
    });

    document.getElementById('closeReportBtn').addEventListener('click', () => {
        document.getElementById('reportView').style.display = 'none';
        document.getElementById('mainDashboard').style.display = 'flex';
    });
    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const newSettings = {
            influencers: document.getElementById('setting_influencers').checked,
            urgency: document.getElementById('setting_urgency').checked,
            ads: document.getElementById('setting_ads').checked,
            lootboxes: document.getElementById('setting_lootboxes').checked,
            custom_prompt: document.getElementById('setting_custom_prompt').value.trim()
        };

        await chrome.storage.local.set({
            'detection_settings': newSettings,
            'safe_list': currentSafeList
        });
        modal.style.display = 'none';
        alert('Preferences and Safe List saved!');
    });
});

let historyData = [];
let currentIndex = 0;
let isPlaying = false;

async function loadHistory() {
    const data = await chrome.storage.local.get('daily_history');
    historyData = data.daily_history || [];

    renderSidebar();
}

function renderSidebar() {
    const list = document.getElementById('eventList');
    list.innerHTML = '';

    if (historyData.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #6b7280; margin-top: 20px;">No events recorded today.</div>';
        return;
    }

    // Sort by newest first
    const sortedHistory = [...historyData].reverse();

    sortedHistory.forEach((item, index) => {
        // Calculate actual index in original array
        const originalIndex = historyData.length - 1 - index;

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

        el.addEventListener('click', () => showEvent(originalIndex));
        list.appendChild(el);
    });
}

function showEvent(index) {
    currentIndex = index;
    const item = historyData[index];

    // Update UI
    document.getElementById('emptyState').style.display = 'none';

    const img = document.getElementById('reelImage');
    img.src = item.imageData;
    img.style.display = 'block';

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

    // Highlight sidebar
    document.querySelectorAll('.event-item').forEach(el => el.classList.remove('active'));
    // Note: Sidebar is reversed, so we need to find the correct element
    // Simple hack: just re-render or find by index logic. For MVP, simple is fine.
}

async function playReel() {
    if (isPlaying) return;
    isPlaying = true;
    const btn = document.getElementById('playReelBtn');
    btn.textContent = 'Playing...';
    btn.disabled = true;

    // Filter for "interesting" events (Medium/High risk)
    // If none, play all.
    let playlist = historyData.map((item, index) => ({ item, index }));
    const highRisk = playlist.filter(p => p.item.analysis && (p.item.analysis.risk_level === 'High' || p.item.analysis.risk_level === 'Medium'));

    if (highRisk.length > 0) {
        playlist = highRisk;
    }

    for (const entry of playlist) {
        showEvent(entry.index);
        // Wait 5 seconds per slide
        await new Promise(r => setTimeout(r, 5000));
    }

    isPlaying = false;
    btn.textContent = '▶ Play Daily Reel';
    btn.disabled = false;
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        await chrome.storage.local.set({ 'daily_history': [] });
        historyData = [];
        renderSidebar();
        document.getElementById('reelImage').style.display = 'none';
        document.getElementById('reelOverlay').style.display = 'none';
        document.getElementById('reelRisk').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
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

// PIN Security Logic
async function checkPinStatus() {
    const data = await chrome.storage.local.get('parent_pin');
    const hasPin = !!data.parent_pin;

    if (!hasPin) {
        document.getElementById('setupPinSection').style.display = 'block';
        document.getElementById('unlockBtn').textContent = 'Set PIN';
    } else {
        document.getElementById('setupPinSection').style.display = 'none';
        document.getElementById('unlockBtn').textContent = 'Unlock';
    }
}

async function handleUnlock() {
    const input = document.getElementById('pinInput');
    const pin = input.value;
    const errorMsg = document.getElementById('pinError');

    if (pin.length !== 4) {
        errorMsg.textContent = 'PIN must be 4 digits';
        errorMsg.style.display = 'block';
        return;
    }

    const data = await chrome.storage.local.get('parent_pin');
    const storedPin = data.parent_pin;

    if (!storedPin) {
        // Setup Mode
        await chrome.storage.local.set({ 'parent_pin': pin });
        alert('PIN Set Successfully! Please remember it.');
        document.getElementById('pinLockScreen').style.display = 'none';
    } else {
        // Unlock Mode
        if (pin === storedPin) {
            document.getElementById('pinLockScreen').style.display = 'none';
            errorMsg.style.display = 'none';
        } else {
            errorMsg.textContent = 'Incorrect PIN';
            errorMsg.style.display = 'block';
            input.value = '';
        }
    }
}

function handleSetupPin(e) {
    e.preventDefault();
    document.getElementById('pinInput').focus();
}
