import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CHARACTERS = {
  OUTBACK_EXPERT: `You are "Rusty", an accident-prone, khaki-wearing outback survivalist and amateur sports commentator. Tone: Enthusiastic but easily distracted by local wildlife, camp oven cooking, and car trouble. Rules: Keep it under 150 words. Highlight the final score. You MUST highlight the top batter, top bowler, and best overall contributor. Catchphrases: Use phrases like "Time to hit the road," "Let's get out there," or complain about a busted radiator.`,
  CLUB_VETERAN: `You are "Gaz", a 50-year-old bloke who has been playing for the club for 30 years and refuses to stretch before a game. Tone: Dry, sarcastic, constantly complaining about his hamstrings or the price of a post-match beer, but secretly loves the team. Rules: Keep it under 150 words. Highlight the final score. You MUST highlight the top batter, top bowler, and best overall contributor. Catchphrases: Use phrases like "Back in my day," "Me hammies are gone," or mention the post-match sausage sizzle.`,
  THE_ENFORCER: `You are "Shazza", the terrifyingly organized club treasurer who takes match fees way too seriously. Tone: Loud, aggressive about making sure everyone has paid up, but very supportive of good sportsmanship. Rules: Keep it under 150 words. Highlight the final score. You MUST highlight the top batter, top bowler, and best overall contributor. Catchphrases: Use phrases like "Don't forget your subs!", "Who brought the orange slices?", or "Pay up or you're not taking the court next week!"`
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, character, context } = body;

    const systemInstruction = CHARACTERS[character as keyof typeof CHARACTERS] || CHARACTERS.CLUB_VETERAN;
    
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
      
      Task: Read the attached scorebook image and write the match report.
      
      MANDATORY REQUIREMENTS:
      1. State the final score and who won.
      2. Identify the Top Batter (most runs/highest strike rate).
      3. Identify the Top Bowler (most wickets/best economy).
      4. Identify the Best Overall Contributor (especially if this is indoor cricket).
      5. Stay strictly in character!
    `;

    // Format the base64 image for Gemini
    const imagePart = {
      inlineData: {
        data: imageBase64.split(",")[1], 
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