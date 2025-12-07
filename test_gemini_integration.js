const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Configuration
const API_KEY = process.env.GOOGLE_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
const IMAGE_PATH = '/Users/trishanpanch/.gemini/antigravity/brain/1f2b169a-c61e-403e-9957-cafb01dc3848/spammy_roblox_site_1764823460213.png';

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

async function testAnalysis() {
    try {
        console.log('Reading image...');
        const imageBuffer = fs.readFileSync(IMAGE_PATH);
        const base64Image = imageBuffer.toString('base64');

        console.log('Sending to Gemini...');
        const requestBody = {
            contents: [{
                parts: [
                    { text: SYSTEM_PROMPT },
                    {
                        inline_data: {
                            mime_type: "image/png", // Changed to png for the test file
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(jsonString);

        console.log('\n--- ANALYSIS RESULT ---');
        console.log(JSON.stringify(analysisResult, null, 2));
        console.log('-----------------------\n');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAnalysis();
