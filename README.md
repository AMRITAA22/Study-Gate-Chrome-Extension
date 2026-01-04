# 🚧 Focus Gate - Study to Scroll

**Focus Gate** is an AI-powered browser extension that transforms distractions into learning opportunities. It blocks time-wasting websites (like YouTube, Twitter, Instagram) and only unlocks them if you pass a quiz generated from your own study notes.

> **"Pay for your distraction with knowledge."**


---

## 🚀 Features

* **🛡️ The Gate:** Automatically blocks distracting sites (YouTube, Social Media) using a "Cyberpunk Glassmorphism" overlay.
* **🧠 AI-Powered Quizzes:** Generates unique multiple-choice questions on the fly using **Google Gemini 2.5 Flash**.
* **📄 PDF Knowledge Base:** Drag & drop lecture slides or PDF textbooks; the extension extracts text locally to generate questions.
* **⚔️ Mastery Mode:** Requires a score of **80% or higher** to unlock the blocked site for 30 minutes.
* **🔥 Gamification:** Tracks your "Study Streak" to keep you motivated.
* **🎨 Customizable:** Adjustable quiz length (1-10 questions) and subject selection.

---

## 🛠️ Technical Architecture

* **Platform:** Chrome Extension (Manifest V3)
* **Build Tool:** Vite (for bundling & asset management)
* **AI Engine:** Google Gemini API (`gemini-2.5-flash`)
* **PDF Engine:** `pdf.js` (Client-side text extraction)
* **Styling:** Modern CSS (Glassmorphism, Animations, Responsive)
* **Storage:** `chrome.storage.local` (Notes, API Keys, Streaks)

---

## 📦 Installation (Developer Mode)

Since this is a custom extension, you need to load it manually into Chrome.

### 1. Prerequisites
* Node.js & npm installed.
* A Google Gemini API Key (Free).

### 2. Build the Project
Clone the repo and install dependencies:
```bash
# Install dependencies (including pdf.js)
npm install

# Build the extension (creates the /dist folder)
npm run build
```

### 3. Load into Chrome
Open Chrome and go to chrome://extensions.

Toggle Developer mode (top right corner).

Click Load unpacked.

Select the dist folder generated in your project directory.

---

## 📂 Project Structure
```Bash
focus-gate-extension/
├── dist/                   # Compiled production code (Load this folder!)
├── src/
│   ├── background/         # Service Worker (AI API calls happen here)
│   ├── content/            # Scripts injected into websites (The "Gate" UI)
│   ├── options/            # Dashboard for uploading PDFs & Notes
│   ├── popup/              # Toolbar popup
│   └── assets/             # Icons and images
├── manifest.json           # Chrome Extension Configuration
├── vite.config.js          # Build configuration
└── package.json            # Dependencies
```
---
## 🔮 Roadmap
* [ ] Mobile App: Port logic to React Native for Android/iOS blocking.
* [ ] Spaced Repetition: Prioritize questions the user previously got wrong.
* [ ] Cloud Sync: Sync notes across devices using Firebase.
* [ ] Strict Mode: "Death Mode" that locks the browser completely if you fail.
---

Made with by AMRITAA22 ❤️