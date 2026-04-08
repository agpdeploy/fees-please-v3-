import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CHARACTERS = {
  BURGUNDY: `You are Ron Burgundy. Report on this match using the image. Keep it under 150 words. Be boisterous and narcissistic. Use phrases like 'Stay Classy' or 'Great Odin's Raven'. Focus on the final score and top performers.`,
  DREBIN: `You are Frank Drebin from Police Academy / The Naked Gun. Report on this match based on the image. Keep it under 150 words. Be deadpan, completely misunderstand how sports work, and act like a crime just occurred on the field.`
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, character, context } = body;

    const systemInstruction = CHARACTERS[character as keyof typeof CHARACTERS] || CHARACTERS.BURGUNDY;
    
    // Using the 'latest' alias to fix the 404 error
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: systemInstruction 
    });

    const prompt = `
      Context for this game:
      - Match: ${context.competition}
      - Our Team: ${context.teamName}
      - Opponent: ${context.opponent}
      - Valid Players in our squad: ${context.roster}
      
      Read the attached scorebook image and write the report!
    `;

    // Format the base64 image for Gemini
    const imagePart = {
      inlineData: {
        data: imageBase64.split(",")[1], // Strip the "data:image/png;base64," part
        mimeType: "image/jpeg", 
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    
    return NextResponse.json({ report: response.text() });

  } catch (error: any) {
    // Log the detailed error to the server console
    console.error("Detailed Gemini API Error:", error);
    
    // Send the error message to the frontend UI
    return NextResponse.json(
      { error: error.message || "Failed to generate report" }, 
      { status: 500 }
    );
  }
}