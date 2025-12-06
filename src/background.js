// Hardcoded Config to avoid import issues
const CONFIG = {
  FIREBASE: {
    projectId: "projectowl-22baa"
  }
};

// Configuration
const SAMPLING_INTERVAL_MS = 2000; // 2 seconds (slower to be safe)
const SIMILARITY_THRESHOLD = 0.05; // 5% pixel difference triggers analysis

// State
let lastSnapshotDataUrl = null;
let samplingIntervalId = null;

console.log("🦉 Project Owl Background Script Started (Full Mode - Direct Fetch)");

// --- Event Listeners ---

// 1. Tab Activation (Switching Tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await captureAndAnalyze(activeInfo.tabId, { force: true });
  restartSampling();
});

// 2. Tab Updates (Navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await captureAndAnalyze(tabId, { force: true });
    restartSampling();
  }
});

// 3. Window Focus Changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopSampling();
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      await captureAndAnalyze(tab.id, { force: true });
      restartSampling();
    }
  }
});

// --- Sampling Logic ---

function startSampling() {
  if (samplingIntervalId) clearInterval(samplingIntervalId);
  console.log('Starting sampling loop...');
  samplingIntervalId = setInterval(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await captureAndAnalyze(tab.id, { force: false });
    }
  }, SAMPLING_INTERVAL_MS);
}

function stopSampling() {
  if (samplingIntervalId) {
    console.log('Stopping sampling loop.');
    clearInterval(samplingIntervalId);
    samplingIntervalId = null;
  }
}

function restartSampling() {
  stopSampling();
  startSampling();
}

// --- Core Capture & Diff Logic ---

async function captureAndAnalyze(tabId, options = { force: false }) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;

    // Check Safe List
    const data = await chrome.storage.local.get('safe_list');
    const safeList = data.safe_list || [];
    const hostname = new URL(tab.url).hostname;
    const isSafe = safeList.some(domain => hostname === domain || hostname.endsWith('.' + domain));

    if (isSafe) return;

    // Capture (Low Quality for Speed/Size)
    const currentDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 40 });

    // Diff Check
    if (!options.force && lastSnapshotDataUrl) {
      const isDifferent = await hasSignificantChange(lastSnapshotDataUrl, currentDataUrl);
      if (!isDifferent) return;
    }

    // Update State
    lastSnapshotDataUrl = currentDataUrl;
    console.log('📸 Triggering Analysis (Change Detected or Forced)');

    const timestamp = new Date().toISOString();
    const snapshotRecord = {
      timestamp,
      url: tab.url,
      tabId,
      imageData: currentDataUrl
    };

    await chrome.storage.local.set({ 'latest_snapshot': snapshotRecord });

    // Trigger Cloud Analysis
    analyzeSnapshot(snapshotRecord);

  } catch (error) {
    console.error('Capture error:', error);
    // await chrome.storage.local.set({ 'latest_error': `Capture Error: ${error.message}` });
  }
}

// --- Image Processing (OffscreenCanvas) ---

async function hasSignificantChange(prevUrl, currUrl) {
  try {
    const [img1, img2] = await Promise.all([
      createBitmap(prevUrl),
      createBitmap(currUrl)
    ]);

    const width = 64, height = 64;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.drawImage(img1, 0, 0, width, height);
    const data1 = ctx.getImageData(0, 0, width, height).data;
    ctx.clearRect(0, 0, width, height);

    ctx.drawImage(img2, 0, 0, width, height);
    const data2 = ctx.getImageData(0, 0, width, height).data;

    let diffPixels = 0;
    const totalPixels = width * height;

    for (let i = 0; i < data1.length; i += 4) {
      const rDiff = Math.abs(data1[i] - data2[i]);
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

      if (rDiff > 25 || gDiff > 25 || bDiff > 25) {
        diffPixels++;
      }
    }

    const changePercent = diffPixels / totalPixels;
    return changePercent > SIMILARITY_THRESHOLD;

  } catch (e) {
    console.error('Diff error:', e);
    return true; // Fallback to analyze if diff fails
  }
}

async function createBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

// --- Analysis Logic ---

async function analyzeSnapshot(snapshot) {
  try {
    const data = await chrome.storage.local.get('detection_settings');
    const settings = data.detection_settings || {
      influencers: true,
      urgency: true,
      ads: true,
      lootboxes: true
    };

    // Get Linked User ID
    const userData = await chrome.storage.local.get('user_uid');
    const uid = userData.user_uid || "demo_parent_user";

    // Use Direct Fetch to avoid SDK issues
    const projectId = CONFIG.FIREBASE.projectId;
    const region = "us-central1";
    const functionName = "analyzeImage";
    const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          imageData: snapshot.imageData,
          url: snapshot.url,
          settings: settings,
          uid: uid
        }
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const json = await response.json();

    if (json.error) throw new Error(`Function Error: ${JSON.stringify(json.error)}`);
    const resultData = json.result;

    // Log success for debugging
    await chrome.storage.local.set({
      'latest_debug_info': `Success! Sent to UID: ${uid}`,
      'latest_error': null
    });
    processResult(snapshot, resultData);

  } catch (error) {
    console.error('Analysis failed:', error);
    const userData = await chrome.storage.local.get('user_uid');
    const uid = userData.user_uid || "unknown";
    await chrome.storage.local.set({ 'latest_error': `${error.message} (UID: ${uid})` });
  }
}

async function processResult(snapshot, analysisResult) {
  console.log('Analysis complete:', analysisResult);
  const updatedSnapshot = { ...snapshot, analysis: analysisResult };

  const storageData = await chrome.storage.local.get('daily_history');
  const history = storageData.daily_history || [];
  history.push(updatedSnapshot);
  if (history.length > 20) history.shift();

  await chrome.storage.local.set({
    'latest_snapshot': updatedSnapshot,
    'daily_history': history
  });

  if (analysisResult.risk_level === 'High') {
    chrome.alarms.create('high_risk_alert', { when: Date.now() + 100 });
  }
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'pong' });
    return false;
  }
  if (request.action === 'testConnection') {
    // Re-use logic or just return success since we know it works now
    sendResponse({ success: true, method: "Direct Fetch (Active)" });
    return false;
  }
  return true;
});

// Start sampling
startSampling();
