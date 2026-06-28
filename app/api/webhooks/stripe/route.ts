import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clubId = session.metadata?.club_id;
        const planTier = session.metadata?.plan_tier;
        const subscriptionId = session.subscription as string;

        if (clubId && subscriptionId && planTier) {
          let planInterval = 'monthly';
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const price = subscription.items.data[0]?.price;
            if (price?.recurring?.interval === 'year') {
              planInterval = 'yearly';
            }
          } catch (e) {
            console.error("Failed to retrieve subscription for interval:", e);
          }

          const { data: currentClub } = await supabase.from('clubs').select('settings, name').eq('id', clubId).single();
          const currentSettings = currentClub?.settings || {};

          await supabase
            .from('clubs')
            .update({
              stripe_subscription_id: subscriptionId,
              plan_tier: planTier,
              settings: { ...currentSettings, has_used_trial: true, cancel_at_period_end: false }
            })
            .eq('id', clubId);

          // SEND ONBOARDING EMAIL
          const { data: admins } = await supabase.from('user_roles')
            .select('email, profiles(first_name)')
            .eq('club_id', clubId)
            .eq('role', 'club_admin');
          
          if (admins && admins.length > 0) {
            const isPro = planTier === 'pro';
            const planName = isPro ? 'Pro' : 'Plus';
            const headline = `Welcome to Fees Please ${planName}!`;
            
            let bodyText = `Your account **{clubName}** is now officially on the ${planName} plan! Your account has been upgraded and you have full access to all premium features.`;
            
            if (isPro) {
              bodyText += ` With Pro, you now have access to advanced reporting and deeper insights.`;
            } else {
              bodyText += ` Start taking advantage of unlimited teams and automated summaries today!`;
            }

            const isTestingEnv = process.env.NODE_ENV !== 'production' || 
                                 process.env.VERCEL_ENV === 'preview' || 
                                 process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost');

            const emailsToSend = [];
            for (const admin of admins) {
              if (!admin.email) continue;
              
              const firstName = admin.profiles?.first_name || 'there';
              const clubName = currentClub?.name || 'your club';
              const personalizedBody = bodyText.replace('{clubName}', clubName);

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
                to: isTestingEnv ? 'emailtesting@feesplease.app' : admin.email,
                subject: `Welcome to ${planName}!`,
                html: htmlContent
              });
            }

            try {
              await resend.batch.send(emailsToSend);
            } catch (err) {
              console.error("Failed to send onboarding email:", err);
            }
          }
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // We evaluate referrals on any successful invoice (could be subsequent month if pending_usage)
        if (
          invoice.billing_reason === 'subscription_create' || 
          invoice.billing_reason === 'subscription_cycle' ||
          invoice.billing_reason === 'subscription_update'
        ) {
          const subscriptionId = (invoice as any).subscription as string;
          
          if (subscriptionId) {
            // Retrieve subscription to get metadata (club_id)
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const clubId = subscription.metadata.club_id;
            
            if (clubId) {
              const { data: club } = await supabase
                .from('clubs')
                .select('referred_by_user_id')
                .eq('id', clubId)
                .single();
                
              if (club?.referred_by_user_id) {
                let { data: referral } = await supabase
                  .from('referrals')
                  .select('*')
                  .eq('referred_club_id', clubId)
                  .single();
                  
                // If they upgraded before hitting the 2 free matches, the referral row won't exist yet!
                if (!referral) {
                  const { data: newRef } = await supabase
                    .from('referrals')
                    .insert({
                      referrer_user_id: club.referred_by_user_id,
                      referred_club_id: clubId,
                      status: 'pending',
                    })
                    .select('*')
                    .single();
                  referral = newRef;
                }
                  
                if (referral && !referral.rewarded_at) {
                  // Since they just paid an invoice for a Stripe subscription, they are a PAID referral!
                  // No need to check usage limits (2 games etc). They're literally on a paid plan now.
                  
                  // Upgrade status to paid
                  await supabase
                    .from('referrals')
                    .update({ status: 'paid', updated_at: new Date().toISOString() })
                    .eq('id', referral.id);
                      
                  // Check referrer roles to determine reward type
                    const { data: userRoles } = await supabase
                      .from('user_roles')
                      .select('club_id')
                      .eq('user_id', club.referred_by_user_id)
                      .in('role', ['club_admin', 'super_admin']);
                      
                    const isReferrerAdmin = userRoles && userRoles.length > 0;
                    
                    if (isReferrerAdmin) {
                      const referrerClubId = userRoles[0].club_id;
                      const { data: referrerClub } = await supabase
                        .from('clubs')
                        .select('plan_tier, stripe_customer_id, name, contact_email')
                        .eq('id', referrerClubId)
                        .single();
                        
                      if (referrerClub) {
                        const isReferrerPaid = referrerClub.plan_tier === 'plus' || referrerClub.plan_tier === 'pro';
                        const creditAmountCents = isReferrerPaid ? 1398 : 699;
                        
                        let customerId = referrerClub.stripe_customer_id;
                        if (!customerId) {
                          const customer = await stripe.customers.create({
                            name: referrerClub.name,
                            email: referrerClub.contact_email || undefined,
                            metadata: { club_id: referrerClubId }
                          });
                          customerId = customer.id;
                          await supabase.from('clubs').update({ stripe_customer_id: customerId }).eq('id', referrerClubId);
                        }
                        
                        // Apply Credit
                        await stripe.customers.createBalanceTransaction(customerId, {
                          amount: -creditAmountCents,
                          currency: 'aud',
                          description: 'Referral Reward: Usage criteria met',
                        });
                        
                        // Mark as rewarded
                        await supabase.from('referrals').update({
                          rewarded_at: new Date().toISOString(),
                          reward_type: 'paid_upgrade',
                          rewarded_amount_cents: creditAmountCents,
                        }).eq('id', referral.id);
                      }
                    } else {
                      // Player Referrer
                      await supabase.from('referrals').update({
                        rewarded_at: new Date().toISOString(),
                        reward_type: 'paid_upgrade',
                      }).eq('id', referral.id);
                      
                      const { count: playerTotal } = await supabase
                        .from('referrals')
                        .select('id', { count: 'exact', head: true })
                        .eq('referrer_user_id', club.referred_by_user_id)
                        .not('rewarded_at', 'is', null);

                      if (playerTotal && playerTotal > 0 && playerTotal % 4 === 0) {
                        await supabase.from('referral_rewards').insert({
                          user_id: club.referred_by_user_id,
                          reward_type: 'external_gift_4_referrals',
                          status: 'pending'
                        });
                      }
                    }
                }
              }
            }
          }
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const clubId = subscription.metadata?.club_id;
        
        if (clubId) {
          await supabase
            .from('clubs')
            .update({
              plan_tier: 'free',
              stripe_subscription_id: null,
            })
            .eq('id', clubId);
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const clubId = subscription.metadata?.club_id;
        
        if (clubId) {
          // If the subscription is past due, unpaid, or canceled, drop them to free.
          if (['past_due', 'unpaid', 'canceled', 'incomplete_expired'].includes(subscription.status)) {
            await supabase
              .from('clubs')
              .update({
                plan_tier: 'free',
                stripe_subscription_id: null,
              })
              .eq('id', clubId);
          } 
          // If the subscription returns to active or trialing, restore their tier.
          else if (['active', 'trialing'].includes(subscription.status)) {
            let planTier = subscription.metadata?.plan_tier || 'plus'; // fallback
            
            const price = subscription.items.data[0]?.price;
            const priceId = price?.id;
            let planInterval = 'monthly';
            if (price?.recurring?.interval === 'year') {
              planInterval = 'yearly';
            }

            // If they updated via Customer Portal, the price ID or product details will tell us the true plan
            if (priceId) {
              if (
                priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 
                priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_ANNUAL
              ) {
                planTier = 'pro';
              } else if (
                priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_MONTHLY || 
                priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_ANNUAL
              ) {
                planTier = 'plus';
              } else {
                // Try product name fallback if they upgraded to a custom/different price in Customer Portal
                try {
                  const productId = typeof price.product === 'string' ? price.product : price.product?.id;
                  if (productId) {
                    const product = await stripe.products.retrieve(productId);
                    const name = product.name.toLowerCase();
                    if (name.includes('pro')) {
                      planTier = 'pro';
                    } else if (name.includes('plus')) {
                      planTier = 'plus';
                    }
                  }
                } catch (e) {
                  console.error("Failed to retrieve product details in webhook:", e);
                }
              }
            }

            // Also update the metadata so it stays in sync in Stripe
            if (subscription.metadata?.plan_tier !== planTier) {
              try {
                await stripe.subscriptions.update(subscription.id, {
                  metadata: { ...subscription.metadata, plan_tier: planTier }
                });
              } catch (e) {
                console.error("Failed to update subscription metadata in Stripe:", e);
              }
            }

            const { data: currentClub } = await supabase.from('clubs').select('settings').eq('id', clubId).single();
            const currentSettings = currentClub?.settings || {};

            await supabase
              .from('clubs')
              .update({
                plan_tier: planTier,
                stripe_subscription_id: subscription.id,
                settings: { ...currentSettings, cancel_at_period_end: subscription.cancel_at_period_end, has_used_trial: true }
              })
              .eq('id', clubId);
          }
        }
        break;
      }
      
      case 'charge.refunded':
      case 'charge.dispute.created': {
        const charge = event.data.object as any;
        
        let clubId: string | undefined;
        
        // If this charge is attached to an invoice/subscription, cancel the subscription immediately
        if (charge.invoice) {
          try {
            const invoice = await stripe.invoices.retrieve(charge.invoice as string) as any;
            if (invoice.subscription) {
              await stripe.subscriptions.cancel(invoice.subscription as string);
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
              clubId = subscription.metadata.club_id;
            }
          } catch (e) {
            console.error("Failed to retrieve invoice/subscription for charge", charge.id, e);
          }
        }
        
        if (clubId) {
          const { data: referral } = await supabase
            .from('referrals')
            .select('*')
            .eq('referred_club_id', clubId)
            .single();
            
          // Clawback if it was rewarded as a paid upgrade
          if (referral && referral.rewarded_at && referral.status === 'paid' && referral.reward_type === 'paid_upgrade' && referral.rewarded_amount_cents) {
            const { data: club } = await supabase
              .from('clubs')
              .select('referred_by_user_id')
              .eq('id', clubId)
              .single();
              
            if (club?.referred_by_user_id) {
              const { data: userRoles } = await supabase
                .from('user_roles')
                .select('club_id')
                .eq('user_id', club.referred_by_user_id)
                .in('role', ['club_admin', 'super_admin']);
                
              if (userRoles && userRoles.length > 0) {
                const referrerClubId = userRoles[0].club_id;
                const { data: referrerClub } = await supabase
                  .from('clubs')
                  .select('stripe_customer_id')
                  .eq('id', referrerClubId)
                  .single();
                  
                if (referrerClub?.stripe_customer_id) {
                  try {
                    // Apply POSITIVE balance transaction to clawback
                    await stripe.customers.createBalanceTransaction(referrerClub.stripe_customer_id, {
                      amount: referral.rewarded_amount_cents, // positive amount
                      currency: 'aud',
                      description: `Referral Clawback: Refund/Dispute on referred account`,
                    });
                    
                    // Mark as clawed_back
                    await supabase
                      .from('referrals')
                      .update({ status: 'clawed_back', updated_at: new Date().toISOString() })
                      .eq('id', referral.id);
                  } catch (e) {
                    console.error("Failed to apply clawback balance transaction", e);
                  }
                }
              }
            }
          }
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
