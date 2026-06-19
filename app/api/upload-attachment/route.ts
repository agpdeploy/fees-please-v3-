import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const clubId = formData.get('clubId') as string || 'general';

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileExt = file.name.split('.').pop();
    const filePath = `${clubId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabaseAdmin.storage
      .from('support-attachments')
      .upload(filePath, file);

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Try to get a signed URL so the user can preview it even if the bucket is private
    const { data: signedData } = await supabaseAdmin.storage
      .from('support-attachments')
      .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours

    return NextResponse.json({ 
      path: filePath, 
      url: signedData?.signedUrl || '',
      name: file.name
    });

  } catch (error: any) {
    console.error("CRITICAL UPLOAD ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
