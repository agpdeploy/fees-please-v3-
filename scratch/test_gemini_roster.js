require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY found");
    return;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const fallbackModels = [
    "gemini-flash-latest",
    "gemini-pro-latest"
  ];

  let lastError = null;

  for (const modelName of fallbackModels) {
    try {
      console.log(`Trying ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(["Hello, just testing API access."]);
      console.log(`Success on ${modelName}:`, result.response.text());
      return;
    } catch (error) {
      console.warn(`[Fallback Warning] Model ${modelName} failed:`, error.message);
      lastError = error;
    }
  }

  console.error("All fallback models failed. Last error:", lastError.message);
}

run();
