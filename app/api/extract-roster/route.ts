import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// 1. Exact same initialization as generate-report. 
// No .replace(), no .trim(), just the raw variable.
const genAI = new GoogleGenerativeAI("AIzaSyCNApXEDvnwOOtaiCkHgpZGsudsB2lWG0E");

export async function POST(req: Request) {
  try {
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