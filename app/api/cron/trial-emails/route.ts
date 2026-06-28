import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export async function GET(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch all clubs that have an active or recently expired trial, AND are still on 'free' plan
    const { data: clubs } = await supabaseAdmin.from('clubs')
      .select('id, name, trial_ends_at, plan_tier')
      .eq('has_had_trial', true)
      .eq('plan_tier', 'free')
      .not('trial_ends_at', 'is', null);

    if (!clubs || clubs.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible clubs found.' });
    }

    const now = new Date();
    const emailsToSend: any[] = [];

    for (const club of clubs) {
      const trialEnds = new Date(club.trial_ends_at);
      const diffTime = trialEnds.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 3600 * 24));
      
      // Calculate days elapsed (14 - daysRemaining)
      const daysElapsed = 14 - daysRemaining;

      let emailType = null;
      let subject = '';
      let headline = '';
      let bodyText = '';

      if (daysElapsed === 0) {
        emailType = 'day_0';
        subject = 'Welcome to your Plus Trial!';
        headline = 'Get the most out of Plus';
        bodyText = `Your 14-day trial of Plus for **{clubName}** is now active! Start using premium features like unlimited teams, automated email summaries, and reduced transaction fees today.`;
      } else if (daysElapsed === 7) {
        emailType = 'day_7';
        subject = "You're halfway there!";
        headline = "How's your trial going?";
        bodyText = `You have 7 days left in your free trial for **{clubName}**. Did you know you can earn rewards by referring a friend? Check out the "Refer a friend" section in your account!`;
      } else if (daysElapsed === 10) {
        emailType = 'day_10';
        subject = 'Your Plus trial is ending soon';
        headline = 'Only 4 days left!';
        bodyText = `Your 14-day trial of Plus for **{clubName}** is almost over. To avoid losing access to premium features, head to the Billing tab in your account and upgrade to a paid plan today.`;
      } else if (daysElapsed === 14) {
        emailType = 'day_14';
        subject = 'Your Plus trial has ended';
        headline = 'You are back on the Free plan';
        bodyText = `Your 14-day trial for **{clubName}** has ended and you've been moved back to the Free plan. To regain access to Plus features, simply upgrade your account in the Billing tab at any time. Continue with Plus to get the most out of Fees Please!`;
      }

      if (emailType) {
        // Fetch club admins to send to
        const { data: admins } = await supabaseAdmin.from('user_roles')
          .select('email, profiles(first_name)')
          .eq('club_id', club.id)
          .eq('role', 'club_admin');
          
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            if (!admin.email) continue;
            
            const firstName = admin.profiles?.first_name || 'there';
            const personalizedBody = bodyText.replace('{clubName}', club.name);

            const htmlContent = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #10b981; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">${headline}</h2>
                <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Hi ${firstName},</p>
                <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">${personalizedBody}</p>
                <br/>
                <a href="https://app.feesplease.app/login" style="display: inline-block; background-color: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;">Log in to your account</a>
              </div>
            `;

            emailsToSend.push({
              from: 'Fees Please <hello@mail.feesplease.app>',
              to: admin.email,
              subject: subject,
              html: htmlContent
            });
          }
        }
      }
    }

    if (emailsToSend.length > 0) {
      const isTestingEnv = process.env.NODE_ENV !== 'production' || 
                           process.env.VERCEL_ENV === 'preview' || 
                           process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost');
      
      const emailPayloads = emailsToSend.map(e => ({
        ...e,
        to: isTestingEnv ? 'emailtesting@feesplease.app' : e.to
      }));

      const { error: sendError } = await resend.batch.send(emailPayloads);
      if (sendError) {
        console.error("Resend Error:", sendError);
        return NextResponse.json({ error: sendError.message }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, sent: emailPayloads.length });
    }

    return NextResponse.json({ success: true, sent: 0, message: 'No emails triggered today.' });
  } catch (err: any) {
    console.error("Trial emails cron error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
