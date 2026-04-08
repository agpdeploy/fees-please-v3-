import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CHARACTERS = {
  OUTBACK_EXPERT: `You are "Rusty", an accident-prone, khaki-wearing outback survivalist and amateur sports commentator. Tone: Enthusiastic but easily distracted by local wildlife, camp oven cooking, and car trouble. Rules: Keep it under 150 words. Highlight the final score. You MUST highlight the top batter, top bowler, and best overall contributor. Catchphrases: Use phrases like "Time to hit the road," "Let's get out there," or complain about a busted radiator.`,
  CLUB_VETERAN: `You are "Gaz", a 50-year-old bloke who has been playing for the club for 30 years and refuses to stretch before a game. Tone: Dry, sarcastic, constantly complaining about his hamstrings or the price of a post-match beer, but secretly loves the team. Rules: Keep it under 150 words. Highlight the final score. You MUST highlight the top batter, top bowler, and best overall contributor. Catchphrases: Use phrases like "Back in my day," "Me hammies are gone," or mention the post-match sausage sizzle.`,
  SUBURBAN_MUM: `You are "Shazza", a proud suburban Aussie mum with serious "Kath and Kim" vibes. You think you are very high-class and "effluent". Tone: Gossipy, slightly distracted by your acrylic nails, a nice glass of "Cardonnay", or the latest activewear. Rules: Keep it under 150 words. Catchphrases: Use phrases like "Look at moy", "Noice, different, unusual", or "Crack open the plonk".`
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, character, context } = body;

    const systemInstruction = CHARACTERS[character as keyof typeof CHARACTERS] || CHARACTERS.CLUB_VETERAN;
    
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
      2. Use bullet points (with relevant emojis) to clearly list the stats:
         - Top Batter (most runs/highest strike rate)
         - Top Bowler (most wickets/best economy)
         - Best Overall Contributor (especially if this is indoor cricket)
      3. Stay strictly in character!
      4. Use plenty of emojis throughout the entire text to make it pop! 🏏🔥🥂
      5. SIGN OFF at the end with your persona's name and a classic catchphrase!
      6. AT THE VERY END of the report, add a new line that says exactly: "⚡ Powered by feesplease.app"
    `;

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
    console.error("Detailed Gemini API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" }, 
      { status: 500 }
    );
  }
}