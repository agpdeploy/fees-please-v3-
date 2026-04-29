import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Pull the key securely from your environment variables (Runtime, not Build-time)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // 2. Initialize the AI with the secure key
    const genAI = new GoogleGenerativeAI(apiKey);

    const body = await req.json();
    const { imageBase64 } = body;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: "You are an expert OCR tool. Extract player names from this sports roster. Return ONLY a valid JSON array of strings. Do not include any conversational text." 
    });

    const prompt = "Extract the player names into a JSON array. Combine the First Name and Last Name.";

    const imagePart = {
      inlineData: {
        data: imageBase64.split(",")[1], 
        mimeType: "image/jpeg", 
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text().trim();
    
    // Clean potential markdown blocks from the AI response and parse
    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return NextResponse.json({ names: JSON.parse(cleanJson) });

  } catch (error: any) {
    console.error("Roster Extraction Error:", error);
    return NextResponse.json({ error: error.message || "Failed to extract roster" }, { status: 500 });
  }
}