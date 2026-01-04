const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

// Define Secret for API Key (Best Practice)
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// System Prompt (Shared with Extension, but now server-side)
// System Prompt (Shared with Extension, but now server-side)
const prompt = `You are "Project Owl," an advanced child safety AI agent. Analyze the screenshot for threats across the "4 Pillars of Digital Safety".
Return ONLY valid JSON. Do not use Markdown code blocks.

Analysis Pillars:
1. Content (What they see): Pornography, graphic violence, hate speech, self-harm, "fake news".
2. Contact (Who they talk to): Predatory grooming, cyberbullying, harassment, stalking, parasocial relationships.
3. Conduct (How they behave): Sexting, bullying others, illegal downloading, oversharing personal info.
4. Commercial (How they are influenced): Dark patterns (fake timers), Loot boxes/Gambling, Undisclosed Influencer marketing, Data harvesting.

Output Format:
{
  "commercial_pressure_score": number, // 0-100 (formerly ad_pressure)
  "risk_level": "Low" | "Medium" | "High",
  "detected_threats": [{ "category": "Content"|"Contact"|"Conduct"|"Commercial", "type": string, "description": string }],
  "summary_for_parent": string
}
`;

// --- 1. Dr. Owl Chat Function ---
exports.drOwlChat = onCall({
    secrets: [geminiApiKey],
    timeoutSeconds: 300
}, async (request) => {
    // Auth Check
    const userId = request.auth ? request.auth.uid : (request.data.uid || "demo_parent_user");
    const { message, history } = request.data;

    // System Prompt for Dr. Owl
    const DR_OWL_SYSTEM_PROMPT = `
You are "Dr. Owl", a compassionate digital safety expert and child psychologist. 
Tone: Reassuring, "Mentoring over Monitoring". You are NOT a spy; you are a partner.
Goal: Interview the parent to understand their specific worries (e.g., gambling, bullying, influencers).

Conversation Flow:
1. Acknowledge their input warmly.
2. Ask 1 follow-up question to dig deeper if needed.
3. Keep it to max 3-4 turns.
4. When you have enough info, end the conversation.

**CRITICAL: HIDDEN OUTPUT**
If you have identified a clear safety concern, OR if the user says they are done, you MUST append a JSON block to the END of your response.
This JSON block will be used to configure the AI monitor.

Format:
[Visible Reply to Parent]
$$$JSON_START$$$
{
  "custom_instructions": "Parent is worried about [Specific Concern]. Flag [Related Keywords] as High Severity."
}
$$$JSON_END$$$
`;

    const chatHistory = history ? history.map(h => ({ role: h.sender === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })) : [];

    // Add current message
    chatHistory.push({ role: 'user', parts: [{ text: message }] });

    // Prepend System Prompt (Gemini doesn't have system role in all versions, putting in first user message or separate variable)
    // For simplicity with this library/model, we'll prepend to history or context.
    const finalHistory = [
        { role: 'user', parts: [{ text: DR_OWL_SYSTEM_PROMPT + "\n\n(Begin Conversation)" }] },
        ...chatHistory
    ];

    try {
        const apiKey = geminiApiKey.value();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: finalHistory })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let textResponse = data.candidates[0].content.parts[0].text;
        let hiddenProfile = null;

        // Parse Hidden JSON
        const jsonMatch = textResponse.match(/\$\$\$JSON_START\$\$\$([\s\S]*?)\$\$\$JSON_END\$\$\$/);
        if (jsonMatch) {
            try {
                hiddenProfile = JSON.parse(jsonMatch[1]);
                textResponse = textResponse.replace(jsonMatch[0], '').trim(); // Remove JSON from visible text
            } catch (e) {
                console.error("JSON Parse Error", e);
            }
        }

        return { reply: textResponse, hiddenProfile };

    } catch (error) {
        console.error("Dr. Owl Error:", error);
        throw new HttpsError("internal", "Dr. Owl is sleeping.", error.message);
    }
});


// --- 2. Analyze Image Function (Updated) ---
exports.analyzeImage = onCall({
    secrets: [geminiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB"
}, async (request) => {
    // 1. Authentication Check
    const userId = request.auth ? request.auth.uid : (request.data.uid || "demo_parent_user");
    const { imageData, settings } = request.data; // Keep 'settings' for backward comp if needed, but prefer Firestore

    if (!imageData) {
        return {
            ad_pressure_score: 0,
            risk_level: "Low",
            detected_threats: [],
            summary_for_parent: "No image data received."
        };
    }

    // 2. Fetch Safety Profile from Firestore
    let parentInstructions = "";
    try {
        const profileDoc = await admin.firestore().collection('users').doc(userId).collection('settings').doc('safetyProfile').get();
        if (profileDoc.exists) {
            parentInstructions = profileDoc.data().custom_instructions;
            console.log(`Loaded Custom Instructions for ${userId}: ${parentInstructions}`);
        }
    } catch (e) {
        console.warn("Could not load safety profile:", e);
    }

    // 3. Build Dynamic Prompt
    let finalPrompt = prompt;

    // Append Dr. Owl's gathered insights
    if (parentInstructions) {
        finalPrompt += `
        
*** IMPORTANT: PARENT SPECIFIC INSTRUCTIONS ***
The parent has explicitly requested you to watch for: "${parentInstructions}"
If this specific threat is found, You MUST flag it as High Risk and mention it in the summary.
`;
    } else if (settings && settings.custom_prompt) {
        // Fallback to client-side prompt if no profile exists
        finalPrompt += `\n\nIMPORTANT PARENT INSTRUCTION: The parent has explicitly requested you to also check for the following: "${settings.custom_prompt}". If this specific threat is found, flag it as High Risk.`;
    }

    try {
        const apiKey = geminiApiKey.value();
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        // ... (Rest of the analysis logic remains the same, assuming 'prompt' is the base system prompt)
        const requestBody = {
            contents: [{
                parts: [
                    { text: finalPrompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageData.split(',')[1]
                        }
                    }
                ]
            }]
        };

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

        // 4. Log to Firestore
        await admin.firestore()
            .collection("users")
            .doc(userId)
            .collection("history")
            .add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                analysis: analysisResult,
                risk_level: analysisResult.risk_level,
                url: request.data.url || "Unknown URL",
                imageData: imageData
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
            content: true,
            contact: true,
            conduct: true,
            commercial: true
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
