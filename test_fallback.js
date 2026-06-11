const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const fallbackModels = [
  "gemini-flash-latest",
  "gemini-2.5-flash-lite", 
  "gemini-2.5-pro",
  "gemini-pro-latest"
];

async function run() {
  const promptArr = ["Say hello"];
  for (const modelName of fallbackModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(promptArr);
      console.log(`${modelName} success!`);
      return;
    } catch (e) {
      console.log(`[Fallback Warning] Model ${modelName} failed:`, e.message);
    }
  }
}
run();
