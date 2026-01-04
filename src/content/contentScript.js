import { BLOCKED_SITES } from '../utils/constants.js';

const currentHostname = window.location.hostname;
const isBlocked = BLOCKED_SITES.some(site => currentHostname.includes(site));

if (isBlocked) {
  checkAccess();
}

function checkAccess() {
  chrome.storage.local.get(['accessExpiry'], (data) => {
    const now = Date.now();
    if (data.accessExpiry && now < data.accessExpiry) {
      return; // ALLOW ACCESS
    } else {
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

// --- QUIZ LOGIC UPGRADE ---
function initializeOverlayLogic() {
  const subjectSelect = document.getElementById('fg-subject-select');
  const startBtn = document.getElementById('fg-start-btn');
  const quizSection = document.getElementById('fg-quiz-section');
  const subjectSection = document.getElementById('fg-subject-section');
  const questionText = document.getElementById('fg-question-text');
  const optionsDiv = document.getElementById('fg-options');

  // QUIZ STATE VARIABLES
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
      const qCount = data.quizLength || 10;

      if (!apiKey) {
        alert("API Key missing! Check Extension Options.");
        startBtn.disabled = false;
        return;
      }

      // Send message to background to generate questions
      chrome.runtime.sendMessage(
        { action: "GENERATE_QUIZ", notes, apiKey, qCount },
        (response) => {
          startBtn.disabled = false;
          startBtn.textContent = "⚔️ Challenge Gate";

          if (response && response.success) {
            // INITIALIZE QUIZ
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
    // Check if quiz is finished
    if (currentQuestionIndex >= quizQuestions.length) {
      finishQuiz();
      return;
    }

    const qData = quizQuestions[currentQuestionIndex];
    
    // Update UI
    questionText.textContent = `${currentQuestionIndex + 1}. ${qData.question}`;
    optionsDiv.innerHTML = '';

    qData.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      
      // Use existing CSS class for styling
      // If you updated overlay.css for the "Cyberpunk" look, 
      // these buttons will pick up those styles automatically.
      
      btn.onclick = () => handleAnswer(opt, qData.answer);
      optionsDiv.appendChild(btn);
    });
  }

  // 4. Handle Answer Click
  function handleAnswer(selectedOption, correctOption) {
    if (selectedOption === correctOption) {
      score++;
    }
    
    // Move to next question immediately (or you could add a delay/animation)
    currentQuestionIndex++;
    renderNextQuestion();
  }

  // 5. Final Score Check
  function finishQuiz() {
    const total = quizQuestions.length;
    const percentage = (score / total) * 100;

    // Clear quiz UI
    optionsDiv.innerHTML = '';
    
    if (percentage >= 80) {
      // SUCCESS: > 80%
      questionText.innerHTML = `
        <div style="color: #4ade80; font-size: 24px;">🎉 PASSED!</div>
        <p>Score: ${score}/${total} (${Math.round(percentage)}%)</p>
        <p>Access granted for 30 minutes.</p>
      `;
      setTimeout(() => grantAccess(), 2000);
    } else {
      // FAIL
      questionText.innerHTML = `
        <div style="color: #ef4444; font-size: 24px;">⛔ FAILED</div>
        <p>Score: ${score}/${total} (${Math.round(percentage)}%)</p>
        <p>You need 80% to pass. Go study!</p>
      `;
      
      // Add a "Retry" button
      const retryBtn = document.createElement('button');
      retryBtn.textContent = "Try Again";
      retryBtn.style.marginTop = "20px";
      retryBtn.style.padding = "10px 20px";
      retryBtn.style.background = "#ef4444";
      retryBtn.style.color = "white";
      retryBtn.style.border = "none";
      retryBtn.style.borderRadius = "8px";
      retryBtn.style.cursor = "pointer";
      
      retryBtn.onclick = () => location.reload(); // Reloads page to restart flow
      optionsDiv.appendChild(retryBtn);
    }
  }

  function grantAccess() {
    const expiry = Date.now() + (30 * 60 * 1000); 
    
    // Update streak (Optional gamification)
    chrome.storage.local.get(['streak'], (res) => {
      const newStreak = (res.streak || 0) + 1;
      chrome.storage.local.set({ accessExpiry: expiry, streak: newStreak }, () => {
        location.reload();
      });
    });
  }
  // 👇 ADD THIS BLOCK: Load and display the streak
  chrome.storage.local.get(['streak'], (result) => {
    const streakCount = result.streak || 0;
    const streakEl = document.getElementById('fg-streak');
    if (streakEl) {
      streakEl.textContent = `Streak: ${streakCount} 🔥`;
    }
  });
}