chrome.runtime.onMessage.addListener((e,o,r)=>{if(e.action==="GENERATE_QUIZ")return console.log("Calling Gemini 2.5 Flash..."),c(e.notes,e.apiKey,e.qCount).then(t=>{r({success:!0,data:t})}).catch(t=>{console.error("Gemini Error:",t),r({success:!1,error:t.message})}),!0});async function c(e,o,r=10){if(!o)throw new Error("API Key is missing! Check Extension Options.");const t=`
  You are a strict teacher. Based on the following notes, generate ${r} multiple-choice questions.
  
  RULES:
  1. Return ONLY raw JSON. No markdown.
  2. The JSON must be an array of objects.
  3. Format: [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "The correct option string"}]
  
  NOTES:
  "${e.substring(0,5e3)}" 
  `,a=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${o}`;try{const n=await(await fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:t}]}]})})).json();if(n.error)throw new Error(n.error.message);if(!n.candidates||n.candidates.length===0)throw new Error("Gemini returned no content. The text might be flagged as unsafe.");const i=n.candidates[0].content.parts[0].text.replace(/```json/g,"").replace(/```/g,"").trim();return JSON.parse(i)}catch(s){throw console.error("AI Generation Failed:",s),s}}
