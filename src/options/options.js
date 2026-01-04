import * as pdfjsLib from 'pdfjs-dist';
// This specific syntax tells Vite to bundle the worker correctly for the browser
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure the worker (Required for PDF.js to work)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- DOM Elements ---
const subjectInput = document.getElementById('subject-input');
const notesInput = document.getElementById('notes-input');
const saveBtn = document.getElementById('save-btn');
const statusMsg = document.getElementById('status-msg');
const subjectsList = document.getElementById('subjects-list');
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
// PDF Elements
const fileUpload = document.getElementById('file-upload');
const pdfStatus = document.getElementById('pdf-status');
const loadingBar = document.getElementById('pdf-loading-bar');
const loadingProgress = document.getElementById('pdf-loading-progress');
// NEW DOM Elements
const questionCountInput = document.getElementById('question-count');
const saveSettingsBtn = document.getElementById('save-settings-btn');
// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  loadApiKey();
  loadSettings();
});

// --- PDF EXTRACTION LOGIC ---
fileUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') {
    alert("Please select a valid PDF file.");
    return;
  }

  // Reset UI for loading
  notesInput.value = '';
  pdfStatus.textContent = `Reading ${file.name}...`;
  loadingBar.style.display = 'block';
  loadingProgress.style.width = '5%';

  try {
    // 1. Read the file
    const arrayBuffer = await file.arrayBuffer();
    
    // 2. Load PDF using the imported library
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    pdfStatus.textContent = `PDF Loaded. Extracting text from ${totalPages} pages...`;
    
    let fullText = '';

    // 3. Loop through every page
    for (let i = 1; i <= totalPages; i++) {
      updateProgress(i, totalPages);
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Join all text items on the page into a string
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    // 4. Success!
    notesInput.value = fullText.trim();
    pdfStatus.textContent = `Success! Extracted text from ${totalPages} pages.`;
    loadingBar.style.display = 'none';
    
    // Auto-fill subject name if empty
    if (!subjectInput.value) {
      subjectInput.value = file.name.replace('.pdf', '');
    }

  } catch (error) {
    console.error("PDF Error:", error);
    pdfStatus.textContent = `Error: ${error.message}`;
    loadingBar.style.display = 'none';
    alert("Failed to extract text. Ensure the PDF has selectable text (not just images).");
  }
});

function updateProgress(currentPage, total) {
  const percentage = Math.round((currentPage / total) * 100);
  loadingProgress.style.width = `${percentage}%`;
  pdfStatus.textContent = `Processing page ${currentPage} of ${total}...`;
}


// --- API KEY LOGIC ---

// Save API Key
saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) return showStatus('Please enter a key', 'red');
  
  // We save it as 'openaiKey' even though it's Gemini, to keep compatibility
  // (You can rename this key in storage if you want, but ensure background.js matches)
  chrome.storage.local.set({ openaiKey: key }, () => {
    showStatus('API Key Saved!', 'green');
  });
});

// Load API Key
function loadApiKey() {
  chrome.storage.local.get(['openaiKey'], (result) => {
    if (result.openaiKey) {
      apiKeyInput.value = result.openaiKey;
    }
  });
}


// --- NOTES SAVING LOGIC ---

saveBtn.addEventListener('click', () => {
  const subject = subjectInput.value.trim();
  const notes = notesInput.value.trim();

  if (!subject || !notes) {
    showStatus('Please fill in both Subject and Notes fields!', 'red');
    return;
  }

  // Quota check (Local storage has limits, warn if > 100kb)
  if (notes.length > 100000) {
      alert("These notes are quite long! The extension might struggle to save them. Try splitting them up.");
  }

  chrome.storage.local.get(['studyData'], (result) => {
    const studyData = result.studyData || {};
    studyData[subject] = notes;
    
    chrome.storage.local.set({ studyData }, () => {
      showStatus('Notes saved successfully!', 'green');
      subjectInput.value = '';
      notesInput.value = '';
      fileUpload.value = ''; 
      pdfStatus.textContent = '';
      loadSubjects();
    });
  });
});


// --- SUBJECT LIST MANAGEMENT ---

function loadSubjects() {
  chrome.storage.local.get(['studyData'], (result) => {
    subjectsList.innerHTML = ''; // Clear list
    const studyData = result.studyData || {};
    const subjects = Object.keys(studyData);

    if (subjects.length === 0) {
      subjectsList.innerHTML = '<p style="color: #94a3b8;">No subjects added yet.</p>';
      return;
    }

    subjects.forEach(subj => {
      const div = document.createElement('div');
      div.className = 'subject-item';
      
      const title = document.createElement('span');
      title.textContent = subj;
      title.style.fontWeight = 'bold';

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'delete-btn';
      delBtn.onclick = () => deleteSubject(subj);

      div.appendChild(title);
      div.appendChild(delBtn);
      subjectsList.appendChild(div);
    });
  });
}

function deleteSubject(subjectName) {
  if (!confirm(`Delete notes for "${subjectName}"?`)) return;

  chrome.storage.local.get(['studyData'], (result) => {
    const studyData = result.studyData || {};
    delete studyData[subjectName];

    chrome.storage.local.set({ studyData }, () => {
      loadSubjects();
    });
  });
}

// --- HELPER ---
function showStatus(msg, color) {
  statusMsg.textContent = msg;
  statusMsg.style.color = color;
  statusMsg.style.display = 'block';
  setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
}

// --- SETTINGS LOGIC ---

// 1. Save Settings
saveSettingsBtn.addEventListener('click', () => {
  const count = parseInt(questionCountInput.value, 10);
  
  if (count < 1 || count > 10) {
    return showStatus('Please choose between 1 and 10 questions.', 'red');
  }

  chrome.storage.local.set({ quizLength: count }, () => {
    showStatus('Settings Saved!', 'green');
  });
});

// 2. Load Settings
function loadSettings() {
  chrome.storage.local.get(['quizLength'], (result) => {
    // Default to 3 if not set
    if (result.quizLength) {
      questionCountInput.value = result.quizLength;
    } else {
      questionCountInput.value = 3;
    }
  });
}