import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error('Missing required environment variables for send-welcome route');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { persistSession: false } 
    });
    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { clubId, stage } = body;

    if (!clubId || !stage) {
      return NextResponse.json({ error: 'Missing clubId or stage' }, { status: 400 });
    }

    // 1. Fetch club info and settings
    const { data: club } = await supabaseAdmin
      .from('clubs')
      .select('name, settings')
      .eq('id', clubId)
      .single();

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    const settings = club.settings || {};
    const currentStage = settings.welcome_email_stage || 'none';

    // Prevent re-sending if already sent this stage or a later stage
    if (stage === 'created' && currentStage !== 'none') {
      return NextResponse.json({ message: 'Created email already sent' }, { status: 200 });
    }
    if (stage === 'onboarded' && currentStage === 'onboarded') {
      return NextResponse.json({ message: 'Onboarded email already sent' }, { status: 200 });
    }

    // 2. Fetch club admins
    const { data: admins } = await supabaseAdmin
      .from('user_roles')
      .select('email, profiles(first_name)')
      .eq('club_id', clubId)
      .eq('role', 'club_admin');

    if (!admins || admins.length === 0) {
      return NextResponse.json({ message: 'No admins found to email' }, { status: 200 });
    }

    const isTestingEnv = process.env.NODE_ENV !== 'production' || 
                         process.env.VERCEL_ENV === 'preview' || 
                         process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost');

    const emailsToSend = [];

    // 3. Prepare the email content based on the stage
    for (const admin of admins) {
      if (!admin.email) continue;
      
      const profiles: any = admin.profiles;
      const firstName = (Array.isArray(profiles) ? profiles[0]?.first_name : profiles?.first_name) || 'there';
      const clubName = club.name || 'your club';

      let subject = '';
      let headline = '';
      let bodyText = '';

      if (stage === 'created') {
        subject = 'Welcome to Fees Please';
        headline = "Let's get your account set up!";
        bodyText = `
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Hi ${firstName},</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Welcome to Fees Please! We want to help you get the most out of <strong>${clubName}</strong>.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Getting set up only takes a few minutes. If your club uses PlayHQ, the process is incredibly fast. If you're using our standard setup, all you need is your logo, your player list, and your fixtures (a spreadsheet or even just screenshots work perfectly). Best of all, using the core platform is completely free.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Log in now to finish your setup and start managing your teams!</p>
        `;
      } else if (stage === 'onboarded') {
        subject = 'Welcome to Fees Please!';
        headline = "You're all set up! Here's what's next.";
        bodyText = `
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Hi ${firstName},</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Welcome to Fees Please! We want to help you get the most out of <strong>${clubName}</strong>.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Firstly, it's all about tracking money. You can now assign your players to games and track their payments. We highly recommend setting up the <strong>Square integration</strong>—it provides the best outcome for seamless payments. (Square charges a small transaction fee, but most users find the convenience well worth it).</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Managing availability is also key. Head over to the <strong>Team Hub</strong> to start tracking who can play each week.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px; font-weight: bold; margin-top: 24px;">Ready to level up?</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">If you want to manage availability directly via email, pay reduced Square fees, use automated team list generators, highlight your sponsors, and access advanced reporting—you can trial <strong>Plus</strong> for 14 days with no credit card required.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">If you have 2 or more teams to manage, we recommend taking a look at our <strong>Pro</strong> plan.</p>
        `;
      }

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">${headline}</h2>
          ${bodyText}
          <br/>
          <a href="https://app.feesplease.app/login" style="display: inline-block; background-color: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;">Log in to your account</a>
        </div>
      `;

      emailsToSend.push({
        from: 'Fees Please <hello@mail.feesplease.app>',
        to: isTestingEnv ? 'emailtesting@feesplease.app' : admin.email,
        subject: subject,
        html: htmlContent
      });
    }

    // Add internal notification if it's the created stage
    if (stage === 'created') {
      emailsToSend.push({
        from: 'Fees Please Notifications <hello@mail.feesplease.app>',
        to: 'ash.pitt@feesplease.app',
        subject: `New Account Created: ${club.name}`,
        html: `<p>A new account has just been created for <strong>${club.name}</strong>.</p>`
      });
    }

    if (emailsToSend.length > 0) {
      await resend.batch.send(emailsToSend);
    }

    // 4. Update the club settings so we don't send it again
    const newSettings = { ...settings, welcome_email_stage: stage };
    await supabaseAdmin
      .from('clubs')
      .update({ settings: newSettings })
      .eq('id', clubId);

    return NextResponse.json({ success: true, emailsSent: emailsToSend.length }, { status: 200 });
  } catch (error: any) {
    console.error('Welcome email error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
