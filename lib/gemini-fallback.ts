import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * Fallback generator for native @google/generative-ai SDK.
 */
export async function generateContentWithFallback(genAI: GoogleGenerativeAI, promptArr: any[], systemInstruction?: string, safetySettings?: any[]) {
  const fallbackModels = [
    "gemini-flash-latest",
    "gemini-2.5-flash-lite", 
    "gemini-2.5-pro",
    "gemini-pro-latest"
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
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
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
