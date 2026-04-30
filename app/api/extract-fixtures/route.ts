import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextResponse } from "next/server";

function formatAussieMobile(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9 && cleaned.startsWith('4')) return `+61${cleaned}`;
  if (cleaned.length === 10 && cleaned.startsWith('04')) return `+61${cleaned.substring(1)}`;
  if (cleaned.length === 11 && cleaned.startsWith('614')) return `+${cleaned}`;
  return phone;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const body = await req.json();
    
    const { fileBase64, mimeType, csvText, teamName } = body; 

    if (!teamName) {
      return NextResponse.json({ error: "Team name is required to filter the draw." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
      ],
      systemInstruction: "You are an expert sports data extraction assistant. Return ONLY a valid JSON array of objects. Do not include conversational text. Keys must be exactly: 'match_date', 'start_time', 'opponent', 'location', 'notes'." 
    });

    // THE FIX: Added STRICT MATCHING RULE
    let promptArr: any[] = [
      `I am providing a master grade fixture list. Extract ONLY the matches involving the team: "${teamName}".
      
      STRICT MATCHING RULE: Do NOT guess or heavily fuzzy-match the team name. If you cannot confidently find an exact match for "${teamName}" (or a very obvious direct abbreviation) in the list of teams, return an empty array [].
      
      For each match confidently found for "${teamName}":
      1. Determine the "opponent" (the other team playing).
      2. Set "match_date" to the start date formatted strictly as YYYY-MM-DD.
      3. Set "start_time" (e.g. "11:00 AM").
      4. Set "location" to the Venue.
      5. Set "notes" to indicate the Round/Fix number and if they are Home or Away (e.g., "Round 1 - Home").
      
      Return as a JSON array.`
    ];

    if (fileBase64 && mimeType) {
      promptArr.push({ inlineData: { data: fileBase64.split(",")[1], mimeType } });
    } else if (csvText) {
      promptArr.push(`\nRaw CSV data:\n${csvText}`);
    } else {
      return NextResponse.json({ error: "No file data provided." }, { status: 400 });
    }

    const result = await model.generateContent(promptArr);
    const response = await result.response;
    const cleanJson = response.text().trim().replace(new RegExp("\\`\\`\\`json", "gi"), "").replace(new RegExp("\\`\\`\\`", "g"), "").trim();
      
    return NextResponse.json({ fixtures: JSON.parse(cleanJson) });

  } catch (error: any) {
    console.error("Fixture Extraction Error:", error);
    return NextResponse.json({ error: "Failed to extract fixtures." }, { status: 500 });
  }
}