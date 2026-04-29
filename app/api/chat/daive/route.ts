import { createEntities } from '@/lib/daive-tools';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (body.action === 'EXECUTE_SETUP') {
       const { name, isClub, sport } = body.data;
       const entityType = isClub ? "Club" : "Team"; 

       console.log(`Direct DB Insert: ${name} (${sport}) as a ${entityType}`);

       const dbResult = await createEntities(name, isClub, sport, entityType, token);

       if (dbResult.success) {
           return NextResponse.json({ status: 'success', clubId: dbResult.clubId });
       } else {
           return NextResponse.json({ error: "DB Setup Failed" }, { status: 500 });
       }
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  } catch (error) {
    console.error("Setup API Crash:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}