const puppeteer = require('puppeteer');
const fs = require('fs');

// Configuration
const API_KEY = 'AIzaSyCM-G8Prk3epmTwDAT5SxNsFHDg9Q6COKU';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
const TARGET_URL = 'https://www.roblox.com'; // We'll test against Roblox home page

const SYSTEM_PROMPT = `
You are "Project Owl," an advanced child safety AI agent. Analyze the screenshot for "soft threats".
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

async function runLiveTest() {
    console.log('1. Launching Browser (Headless)...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set viewport to simulate a laptop
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`2. Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

    console.log('3. Capturing Screenshot...');
    const screenshotBuffer = await page.screenshot({ encoding: 'base64' });

    await browser.close();

    console.log('4. Sending to Gemini for Analysis...');

    const requestBody = {
        contents: [{
            parts: [
                { text: SYSTEM_PROMPT },
                {
                    inline_data: {
                        mime_type: "image/png",
                        data: screenshotBuffer
                    }
                }
            ]
        }]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(jsonString);

        console.log('\n--- LIVE ANALYSIS RESULT ---');
        console.log(`Target: ${TARGET_URL}`);
        console.log(JSON.stringify(analysisResult, null, 2));
        console.log('----------------------------\n');

    } catch (error) {
        console.error('Analysis Failed:', error);
    }
}

runLiveTest();
