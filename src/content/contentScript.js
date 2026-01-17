import { BLOCKED_SITES } from '../utils/constants.js';

const currentHostname = window.location.hostname;
const isBlocked = BLOCKED_SITES.some(site => currentHostname.includes(site));

if (isBlocked) {
  checkAccess();
  // Heartbeat: Check status every 5 seconds
  setInterval(checkAccess, 5000);
}

function checkAccess() {
  chrome.storage.local.get(['accessExpiry'], (data) => {
    const now = Date.now();
    
    // If access is active, do nothing
    if (data.accessExpiry && now < data.accessExpiry) {
      return; 
    } 
    
    // If access expired, Lock the Screen (if not already locked)
    if (!document.getElementById('focus-gate-overlay')) {
      activateLock();
    }
  });
}

function activateLock() {
  window.stop();
  document.documentElement.innerHTML = '';
  
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

function initializeOverlayLogic() {
  // Elements
  const subjectSelect = document.getElementById('fg-subject-select');
  const startBtn = document.getElementById('fg-start-btn');
  const quizSection = document.getElementById('fg-quiz-section');
  const subjectSection = document.getElementById('fg-subject-section');
  const questionText = document.getElementById('fg-question-text');
  const optionsDiv = document.getElementById('fg-options');
  const streakEl = document.getElementById('fg-streak');

  // --- 1. CHECK COOLDOWN FIRST ---
  chrome.storage.local.get(['nextQuizTime', 'studyData', 'streak', 'openaiKey', 'quizLength'], (data) => {
    const now = Date.now();
    const unlockTime = data.nextQuizTime || 0;

    // Show Streak
    if (streakEl) streakEl.textContent = `Streak: ${data.streak || 0} 🔥`;

    // CASE A: COOLDOWN ACTIVE (User must wait)
    if (now < unlockTime) {
      renderCooldownScreen(unlockTime);
      return; // Stop here, don't show quiz options
    }

    // CASE B: QUIZ AVAILABLE (Populate Dropdown)
    const subjects = Object.keys(data.studyData || {});
    if (subjects.length === 0) {
      subjectSelect.innerHTML = '<option disabled selected>No notes found. Go to Options!</option>';
      startBtn.disabled = true;
      return;
    }

    subjectSelect.innerHTML = '<option value="" disabled selected>Select a Subject</option>';
    subjects.forEach(subj => {
      const opt = document.createElement('option');
      opt.value = subj;
      opt.text = subj;
      subjectSelect.add(opt);
    });

    // Setup Quiz Logic
    setupQuizListeners(data);
  });

  // --- HELPER: RENDER COOLDOWN SCREEN ---
  function renderCooldownScreen(unlockTime) {
    // Hide standard UI
    subjectSection.style.display = 'none';
    quizSection.style.display = 'none';

    // Update Header Text
    document.querySelector('.fg-header h2').textContent = "⏳ Strict Mode Active";
    document.querySelector('.fg-subtitle').textContent = "You have used your 30 minutes.";

    // Create Timer UI
    const container = document.querySelector('.fg-glass-card');
    const msgDiv = document.createElement('div');
    msgDiv.style.marginTop = "30px";
    msgDiv.innerHTML = `
      <div style="font-size: 16px; color: #94a3b8; margin-bottom: 10px;">
        Go study! The gate will re-open in:
      </div>
      <div id="fg-countdown" style="font-size: 48px; font-weight: 800; color: #facc15; font-family: monospace;">
        --:--
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 20px;">
        (Blocking is enforced for 1 hour)
      </div>
    `;
    container.appendChild(msgDiv);

    // Start Live Countdown
    const timerInterval = setInterval(() => {
      const remaining = unlockTime - Date.now();
      if (remaining <= 0) {
        clearInterval(timerInterval);
        location.reload(); // Reload to show the quiz again!
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        document.getElementById('fg-countdown').textContent = 
          `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
      }
    }, 1000);
  }

  // --- HELPER: QUIZ LISTENERS ---
  function setupQuizListeners(storedData) {
    let quizQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;

    startBtn.addEventListener('click', () => {
      const subject = subjectSelect.value;
      if (!subject) return alert("Please select a subject!");

      startBtn.textContent = "Summoning AI...";
      startBtn.disabled = true;
      const notes = storedData.studyData[subject];
      const apiKey = storedData.openaiKey;
      const qCount = storedData.quizLength || 3;

      if (!apiKey) return alert("API Key missing!");

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
            alert("Error: " + (response?.error || "Unknown"));
          }
        }
      );
    });

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

    function handleAnswer(selected, correct) {
      if (selected === correct) score++;
      currentQuestionIndex++;
      renderNextQuestion();
    }

    function finishQuiz() {
      const total = quizQuestions.length;
      const percentage = (score / total) * 100;
      optionsDiv.innerHTML = '';
      
      if (percentage >= 80) {
        // SUCCESS
        questionText.innerHTML = `
          <div style="color: #4ade80; font-size: 24px; font-weight: 800;">🎉 ACCESS GRANTED</div>
          <p>Score: ${score}/${total}</p>
          <p>You have 30 minutes before the 1-hour lockout begins.</p>
        `;
        setTimeout(() => grantAccess(), 2500);
      } else {
        // FAIL
        questionText.innerHTML = `
          <div style="color: #f87171; font-size: 24px; font-weight: 800;">⛔ FAILED</div>
          <p>Score: ${score}/${total}</p>
        `;
        const retryBtn = document.createElement('button');
        retryBtn.textContent = "🔄 Retry Quiz";
        retryBtn.className = 'fg-btn-danger';
        retryBtn.onclick = () => location.reload(); 
        optionsDiv.appendChild(retryBtn);
      }
    }
  }

  // --- UPDATED GRANT ACCESS LOGIC ---
  function grantAccess() {
    const now = Date.now();
    const accessDuration = 30 * 60 * 1000; // 30 Minutes Access
    const cooldownDuration = 60 * 60 * 1000; // 1 Hour Block
    
    // accessExpiry = When site CLOSES
    const accessExpiry = now + accessDuration; 
    
    // nextQuizTime = When quiz RE-OPENS (Access time + 1 hour lockout)
    const nextQuizTime = accessExpiry + cooldownDuration;

    chrome.storage.local.get(['streak'], (res) => {
      const newStreak = (res.streak || 0) + 1;
      chrome.storage.local.set({ 
        accessExpiry: accessExpiry, 
        nextQuizTime: nextQuizTime, // <--- SAVING THE COOLDOWN
        streak: newStreak 
      }, () => {
        location.reload();
      });
    });
  }
}