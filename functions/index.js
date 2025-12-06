const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

// Define Secret for API Key (Best Practice)
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// System Prompt (Shared with Extension, but now server-side)
const prompt = `You are "Project Owl," an advanced child safety AI agent. Analyze the screenshot for "soft threats".
Return ONLY valid JSON. Do not use Markdown code blocks.

Analysis Categories:
1. Ad-Pressure Index (0-100): Score based on visual clutter, "Buy" buttons, urgency.
2. Influencer/Sponsorship: Detect people selling products or hidden "Ad" text.
3. Dark Pattern Shield: Manipulative UI (fake timers, disguised ads).
4. Content Safety Tags: Violence, Pornography, Gambling, Hard Selling.

Output Format:
{
  "ad_pressure_score": number,
  "risk_level": "Low" | "Medium" | "High",
  "detected_threats": [{ "type": string, "description": string }],
  "summary_for_parent": string
}
`;

exports.analyzeImage = onCall({
    secrets: [geminiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB"
}, async (request) => {
    // 1. Authentication Check (Disabled for MVP Demo)
    // if (!request.auth) {
    //   throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    // }

    // 1. Authentication Check
    // Use the authenticated user ID if available, otherwise check for a manually passed 'uid' (from extension)
    // Fallback to "demo_parent_user" only if neither exists.
    const userId = request.auth ? request.auth.uid : (request.data.uid || "demo_parent_user");

    const { imageData, settings } = request.data;

    if (!imageData) {
        // throw new HttpsError("invalid-argument", "The function must be called with an 'imageData' argument.");
        console.warn("No imageData provided. Using placeholder.");
        // We can't analyze without image, so maybe return a dummy result or error?
        // Let's return a dummy result to prove connectivity.
        return {
            ad_pressure_score: 0,
            risk_level: "Low",
            detected_threats: [],
            summary_for_parent: "No image data received for analysis. Connectivity check passed."
        };
    }

    // 2. Build Dynamic Prompt based on Settings
    let finalPrompt = prompt;

    if (settings && settings.custom_prompt) {
        finalPrompt += `\n\nIMPORTANT PARENT INSTRUCTION: The parent has explicitly requested you to also check for the following: "${settings.custom_prompt}". If this specific threat is found, flag it as High Risk.`;
    }

    try {
        const apiKey = geminiApiKey.value();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: finalPrompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageData.split(',')[1] // Remove data:image/jpeg;base64, prefix if present
                        }
                    }
                ]
            }]
        };

        // 3. Call Gemini API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", data.error);
            throw new HttpsError("internal", "AI Analysis failed", data.error);
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(jsonString);

        // 4. Log to Firestore (Secure Server-Side Logging)
        await admin.firestore()
            .collection("users")
            .doc(userId)
            .collection("history")
            .add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                analysis: analysisResult,
                risk_level: analysisResult.risk_level,
                url: request.data.url || "Unknown URL", // Ensure URL is stored
                imageData: imageData // Store image for Daily Reel (Base64)
            });

        return analysisResult;

    } catch (error) {
        console.error("Analysis Error:", error);
        throw new HttpsError("internal", "Analysis failed", error.message);
    }
});

// Trigger: When a new user is created, set default settings
exports.onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) { return; }

    return snapshot.ref.set({
        settings: {
            influencers: true,
            urgency: true,
            ads: true,
            lootboxes: true
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
});

// New Function: Generate Daily Safety Report
exports.generateDailyReport = onCall({
    secrets: [geminiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB"
}, async (request) => {
    // Auth check
    const userId = request.auth ? request.auth.uid : (request.data.uid || "demo_parent_user");
    const { history } = request.data;

    if (!history || !Array.isArray(history) || history.length === 0) {
        return { report: "No activity recorded today to analyze." };
    }

    // Prepare data for AI (Summarize to save tokens)
    const activityLog = history.map(h => {
        return `- [${h.timestamp}] ${h.url} (Risk: ${h.analysis.risk_level}): ${h.analysis.summary_for_parent}`;
    }).join("\n");

    const REPORT_SYSTEM_PROMPT = `
You are Dr. Owl, a compassionate Child Psychologist and Online Safety Expert. 
Your goal is to help parents understand their child's digital day and guide them in having constructive, non-judgmental conversations.

Input: A log of the child's browsing activity for the day, including AI risk assessments.

Task: Generate a "Daily Digital Wellness Report" in Markdown format.

Structure:
1. **Daily Overview**: A gentle summary of the main themes (e.g., "Leo was mostly interested in gaming and toys today...").
2. **Safety Insights**: Highlight any specific risks found (High/Medium) and *why* they matter psychologically (e.g., "The urgency in these ads can create anxiety...").
3. **Conversation Starters**: Provide 3 specific, open-ended questions the parent can ask. (e.g., "I saw you were looking at X, what did you think about...?").
4. **Expert Tip**: One actionable tip for digital wellbeing relevant to today's activity.

Tone: Supportive, educational, calm, and professional. Avoid being alarmist.
`;

    try {
        const apiKey = geminiApiKey.value();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: REPORT_SYSTEM_PROMPT },
                    { text: `Here is today's activity log:\n${activityLog}` }
                ]
            }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        const reportMarkdown = data.candidates[0].content.parts[0].text;
        return { report: reportMarkdown };

    } catch (error) {
        console.error("Report Generation Error:", error);
        throw new HttpsError("internal", "Failed to generate report", error.message);
    }
});
