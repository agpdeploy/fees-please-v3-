import { GoogleGenerativeAI } from "@google/generative-ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Fallback generator for native @google/generative-ai SDK.
 */
export async function generateContentWithFallback(genAI: GoogleGenerativeAI, promptArr: any[], systemInstruction?: string, safetySettings?: any[]) {
  const fallbackModels = [
    "gemini-flash-latest",
    "gemini-pro-latest",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
  ];

  let lastError: any = null;

  for (const modelName of fallbackModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(safetySettings ? { safetySettings } : {})
      });
      const result = await model.generateContent(promptArr);
      return result;
    } catch (error: any) {
      console.warn(`[Fallback Warning] Model ${modelName} failed:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`All fallback models failed. Last error: ${lastError?.message}`);
}

/**
 * Fallback generator for Vercel AI SDK (@ai-sdk/google).
 */
export async function generateTextWithFallback(params: any) {
  const fallbackModels = [
    "gemini-flash-latest",
    "gemini-pro-latest",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
  ];
  
  let lastError: any = null;
  for (const modelName of fallbackModels) {
    try {
      return await generateText({
        ...params,
        model: google(modelName)
      });
    } catch (error: any) {
      console.warn(`[Fallback Warning] AI SDK Model ${modelName} failed:`, error.message);
      lastError = error;
    }
  }
  
  throw new Error(`All fallback models failed. Last error: ${lastError?.message}`);
}
