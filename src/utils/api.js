export async function generateQuiz(notes, apiKey) {
  // Instead of fetching directly, we ask the background script
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "GENERATE_QUIZ", notes, apiKey },
      (response) => {
        if (response && response.success) {
          resolve(response.data);
        } else {
          console.error("Quiz Error:", response ? response.error : "Unknown error");
          resolve(null);
        }
      }
    );
  });
}