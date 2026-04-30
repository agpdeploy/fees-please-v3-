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
    
    // We now accept fileBase64 and mimeType instead of hardcoding imageBase64
    const { fileBase64, mimeType, csvText } = body; 

    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      // Maximum safety settings to silently block inappropriate content
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
      ],
      systemInstruction: "You are an expert data extraction assistant. Extract the player roster from the provided data. Return ONLY a valid JSON array of objects. Do not include any conversational text. Each object MUST have these exact keys: 'firstName', 'lastName', 'nickname', 'email', and 'mobile'. If a piece of data is missing, leave the string empty." 
    });

    let promptArr: any[] = ["Extract the roster into a JSON array. Look closely for email addresses (containing @) and mobile numbers. If there is a 'preferred name', 'known as', or 'nickname' column, extract it into 'nickname'. Format strictly as [{ \"firstName\": \"...\", \"lastName\": \"...\", \"nickname\": \"...\", \"email\": \"...\", \"mobile\": \"...\" }]"];

    // Handle Image/PDF OR CSV data
    if (fileBase64 && mimeType) {
      promptArr.push({
        inlineData: {
          data: fileBase64.split(",")[1], 
          mimeType: mimeType, // This will be "image/jpeg" or "application/pdf"
        }
      });
    } else if (csvText) {
      promptArr.push(`\nHere is the raw CSV data:\n${csvText}`);
    } else {
      return NextResponse.json({ error: "No file data provided." }, { status: 400 });
    }

    const result = await model.generateContent(promptArr);
    const response = await result.response;
    const responseText = response.text().trim();
    
    const cleanJson = responseText
      .replace(new RegExp("\\`\\`\\`json", "gi"), "")
      .replace(new RegExp("\\`\\`\\`", "g"), "")
      .trim();
      
    let parsedData = JSON.parse(cleanJson);

    if (Array.isArray(parsedData)) {
      parsedData = parsedData.map((p: any) => ({
        ...p,
        mobile: formatAussieMobile(p.mobile || "")
      }));
    }

    return NextResponse.json({ players: parsedData });

  } catch (error: any) {
    console.error("Roster Extraction Error:", error);
    // Return a generic error to the frontend if safety gets triggered or parsing fails
    return NextResponse.json({ error: "Failed to extract roster or file was rejected." }, { status: 500 });
  }
}