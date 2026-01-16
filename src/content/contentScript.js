import { BLOCKED_SITES } from '../utils/constants.js';

const currentHostname = window.location.hostname;
const isBlocked = BLOCKED_SITES.some(site => currentHostname.includes(site));

if (isBlocked) {
  // 1. Check immediately on load
  checkAccess();
  
  // 2. Start a "Heartbeat" to check every 5 seconds
  // This catches you if the timer expires WHILE you are watching a video
  setInterval(checkAccess, 5000);
}

function checkAccess() {
  chrome.storage.local.get(['accessExpiry'], (data) => {
    const now = Date.now();
    
    // If access is valid and not expired...
    if (data.accessExpiry && now < data.accessExpiry) {
      // ...do nothing (User is allowed to watch)
      return; 
    } 
    
    // If time is up (or never existed), LOCK THE SCREEN.
    // BUT first, check if it's ALREADY locked to prevent flickering.
    if (!document.getElementById('focus-gate-overlay')) {
      activateLock();
    }
  });
}

function activateLock() {
  // Stop any playing video/audio immediately
  window.stop();
  
  // Nuke the entire page content
  document.documentElement.innerHTML = '';
  
  // Load the Gate
  fetch(chrome.runtime.getURL('src/content/overlay.html'))
    .then(r => r.text())
    .then(html => {
      document.documentElement.innerHTML = html;
      injectCSS();
      initializeOverlayLogic();
    });
}

function injectCSS() {
  const link = document.createElement('link');
  link.href = chrome.runtime.getURL('src/content/overlay.css');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

// --- QUIZ LOGIC (Same as before) ---
function initializeOverlayLogic() {
  
  // 👇 Load Streak Display
  chrome.storage.local.get(['streak'], (result) => {
    const streakCount = result.streak || 0;
    const streakEl = document.getElementById('fg-streak');
    if (streakEl) {
      streakEl.textContent = `Streak: ${streakCount} 🔥`;
    }
  });

  const subjectSelect = document.getElementById('fg-subject-select');
  const startBtn = document.getElementById('fg-start-btn');
  const quizSection = document.getElementById('fg-quiz-section');
  const subjectSection = document.getElementById('fg-subject-section');
  const questionText = document.getElementById('fg-question-text');
  const optionsDiv = document.getElementById('fg-options');

  // QUIZ STATE
  let quizQuestions = [];
  let currentQuestionIndex = 0;
  let score = 0;

  // 1. Populate Dropdown
  chrome.storage.local.get(['studyData'], (result) => {
    const subjects = Object.keys(result.studyData || {});
    
    if (subjects.length === 0) {
      subjectSelect.innerHTML = '<option disabled selected>No notes found. Go to Options!</option>';
      startBtn.disabled = true;
      startBtn.textContent = "Add Notes First";
      return;
    }

    subjectSelect.innerHTML = '<option value="" disabled selected>Select a Subject</option>';
    subjects.forEach(subj => {
      const opt = document.createElement('option');
      opt.value = subj;
      opt.text = subj;
      subjectSelect.add(opt);
    });
  });

  // 2. Start Quiz
  startBtn.addEventListener('click', () => {
    const subject = subjectSelect.value;
    if (!subject) return alert("Please select a subject!");

    startBtn.textContent = "Summoning AI...";
    startBtn.disabled = true;

    chrome.storage.local.get(['studyData', 'openaiKey', 'quizLength'], (data) => {
      const notes = data.studyData[subject];
      const apiKey = data.openaiKey;
      const qCount = data.quizLength || 3;

      if (!apiKey) {
        alert("API Key missing! Check Extension Options.");
        startBtn.disabled = false;
        return;
      }

      chrome.runtime.sendMessage(
        { action: "GENERATE_QUIZ", notes, apiKey, qCount },
        (response) => {
          startBtn.disabled = false;
          startBtn.textContent = "⚔️ Challenge Gate";

          if (response && response.success) {
            quizQuestions = response.data;
            currentQuestionIndex = 0;
            score = 0;
            subjectSection.style.display = 'none';
            quizSection.style.display = 'block';
            renderNextQuestion();
          } else {
            alert("Failed to generate quiz: " + (response ? response.error : "Unknown error"));
          }
        }
      );
    });
  });

  // 3. Render Question Loop
  function renderNextQuestion() {
    if (currentQuestionIndex >= quizQuestions.length) {
      finishQuiz();
      return;
    }

    const qData = quizQuestions[currentQuestionIndex];
    questionText.textContent = `${currentQuestionIndex + 1}. ${qData.question}`;
    optionsDiv.innerHTML = '';

    qData.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.onclick = () => handleAnswer(opt, qData.answer);
      optionsDiv.appendChild(btn);
    });
  }

  function handleAnswer(selectedOption, correctOption) {
    if (selectedOption === correctOption) {
      score++;
    }
    currentQuestionIndex++;
    renderNextQuestion();
  }

  // 4. Final Score Check
  function finishQuiz() {
    const total = quizQuestions.length;
    const percentage = (score / total) * 100;
    optionsDiv.innerHTML = '';
    
    if (percentage >= 80) {
      // SUCCESS
      questionText.innerHTML = `
        <div style="color: #4ade80; font-size: 24px; font-weight: 800; margin-bottom: 10px;">🎉 ACCESS GRANTED</div>
        <p>Score: ${score}/${total} (${Math.round(percentage)}%)</p>
        <p style="font-size: 14px; opacity: 0.8;">The gate opens for 30 minutes.</p>
      `;
      setTimeout(() => grantAccess(), 2000);
    } else {
      // FAIL
      questionText.innerHTML = `
        <div style="color: #f87171; font-size: 24px; font-weight: 800; margin-bottom: 10px;">⛔ ACCESS DENIED</div>
        <p>Score: ${score}/${total} (${Math.round(percentage)}%)</p>
        <p style="font-size: 14px; opacity: 0.8;">Required: 80%. Review your notes!</p>
      `;
      
      const retryBtn = document.createElement('button');
      retryBtn.innerHTML = "<span>🔄 Retry Quiz</span>";
      retryBtn.className = 'fg-btn-danger';
      retryBtn.onclick = () => location.reload(); 
      optionsDiv.appendChild(retryBtn);
    }
  }

  function grantAccess() {
    // 30 Minutes Timer
    const expiry = Date.now() + (30 * 60 * 1000); 
    
    chrome.storage.local.get(['streak'], (res) => {
      const newStreak = (res.streak || 0) + 1;
      chrome.storage.local.set({ accessExpiry: expiry, streak: newStreak }, () => {
        location.reload();
      });
    });
  }
}