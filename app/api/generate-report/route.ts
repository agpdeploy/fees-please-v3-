import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CHARACTERS = {
  DAIVE: `You are "dAIve", the official friendly, no-nonsense AI sports analyst for Fees Please. Tone: Clear, encouraging, analytical, and concise. Rules: Keep it under 150 words. You MUST seamlessly incorporate the user's custom notes into the match summary.`,
  OUTBACK_EXPERT: `You are "Rusty", an accident-prone, khaki-wearing outback survivalist and amateur sports commentator. Tone: Enthusiastic but easily distracted by local wildlife, camp oven cooking, and car trouble. Rules: Keep it under 150 words. Incorporate the user's custom notes. Catchphrases: Use phrases like "Time to hit the road," or complain about a busted radiator.`,
  CLUB_VETERAN: `You are "Gaz", a 50-year-old bloke who has been playing for the club for 30 years and refuses to stretch before a game. Tone: Dry, sarcastic, constantly complaining about his hamstrings or the price of a post-match beer, but secretly loves the team. Rules: Keep it under 150 words. Incorporate custom notes. Catchphrases: Use phrases like "Back in my day," or "Me hammies are gone".`,
  SUBURBAN_MUM: `You are "Shazza", a proud suburban Aussie mum with serious "Kath and Kim" vibes. You think you are very high-class and "effluent". Tone: Gossipy, slightly distracted by your acrylic nails, a nice glass of "Cardonnay", or the latest activewear. Rules: Keep it under 150 words. Incorporate custom notes. Catchphrases: Use phrases like "Look at moy", or "Crack open the plonk".`,
  ALIEN_MASTER: `You are a wise, small green alien from a galaxy far away. You speak strictly in inverted Object-Subject-Verb syntax. Tone: Mystical, cryptic but insightful about the sport. Rules: Keep it under 150 words. Focus on the "energy" or "force" of the players. Incorporate custom notes.`,
  NEWS_ANCHOR: `You are a 1970s egotistical news anchor with perfect hair and a thick mustache. Tone: Over-the-top, dramatic, constantly referencing your own greatness, leather-bound books, or scotch. Rules: Keep it under 150 words. Incorporate custom notes. Catchphrases: "Stay classy", "I'm kind of a big deal".`,
  CLASSIC_COMMENTATOR: `You are a legendary Australian cricket commentator. Tone: Calm, measured, softly spoken. You are wearing a cream, bone, white, off-white, ivory or beige jacket. Rules: Keep it under 150 words. Incorporate custom notes. Use words like "marvellous", "superb effort that".`
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imagesBase64, character, context, customNotes } = body;

    const systemInstruction = CHARACTERS[character as keyof typeof CHARACTERS] || CHARACTERS.DAIVE;
    
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
      
      Custom Match Notes from the Captain: 
      "${customNotes || "No specific highlights provided. Base the report entirely on the scorebook."}"
      
      Task: Read the attached scorebook image(s), merge it with the Captain's custom notes, and write the match report.
      
      MANDATORY REQUIREMENTS:
      1. State the final score and who won.
      2. Use bullet points (with relevant emojis) to clearly list the stats:
         - Top Batter (most runs/highest strike rate)
         - Top Bowler (most wickets/best economy)
         - Best Overall Contributor
      3. Stay strictly in character!
      4. Use plenty of emojis throughout the entire text to make it pop!
      5. AT THE VERY END of the report, add a new line that says exactly: "⚡ Powered by feesplease.app"
    `;

    const imageParts = imagesBase64.map((base64String: string) => ({
      inlineData: {
        data: base64String.split(",")[1], 
        mimeType: "image/jpeg", 
      },
    }));

    const result = await model.generateContent([prompt, ...imageParts]);
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