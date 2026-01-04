// background.js

// CONFIGURATION: Set this to 'true' if you want to test without using an API Key
const USE_DUMMY_MODE = false;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GENERATE_QUIZ") {
    
    if (USE_DUMMY_MODE) {
      console.log("Using Dummy Mode...");
      setTimeout(() => {
        sendResponse({ success: true, data: getDummyQuestions() });
      }, 1000);
    } else {
      console.log("Calling Gemini 2.5 Flash...");
      generateQuizWithGemini(request.notes, request.apiKey, request.qCount)
        .then(questions => {
          sendResponse({ success: true, data: questions });
        })
        .catch(error => {
          console.error("Gemini Error:", error);
          sendResponse({ success: false, error: error.message });
        });
    }

    return true; // Keep the message channel open for the async response
  }
});

// --- REAL AI LOGIC (Gemini 2.5 Flash) ---
async function generateQuizWithGemini(notes, apiKey, qCount = 10) {
  if (!apiKey) throw new Error("API Key is missing! Check Extension Options.");

  const prompt = `
  You are a strict teacher. Based on the following notes, generate ${qCount} multiple-choice questions.
  
  RULES:
  1. Return ONLY raw JSON. No markdown.
  2. The JSON must be an array of objects.
  3. Format: [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "The correct option string"}]
  
  NOTES:
  "${notes.substring(0, 5000)}" 
  `;

  // UPDATED: Using 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      // Common error: "User location is not supported" or "API key not valid"
      throw new Error(data.error.message);
    }

    // Parse Gemini Response
    // Gemini 2.5 structure is consistent with previous versions
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned no content. The text might be flagged as unsafe.");
    }

    const rawText = data.candidates[0].content.parts[0].text;
    
    // Clean up if the AI adds markdown backticks
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("AI Generation Failed:", error);
    throw error;
  }
}

// --- DUMMY DATA GENERATOR (Fallback) ---
function getDummyQuestions() {
  return [
    {
      "question": "DUMMY MODE: What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "answer": "Paris"
    },
    {
      "question": "DUMMY MODE: What is 5 + 5?",
      "options": ["10", "20", "55", "0"],
      "answer": "10"
    },
    {
      "question": "DUMMY MODE: Which planet is the Red Planet?",
      "options": ["Earth", "Mars", "Venus", "Jupiter"],
      "answer": "Mars"
    }
  ];
}