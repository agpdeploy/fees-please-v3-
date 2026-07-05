const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// 1. Load env variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local file not found at " + envPath);
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').replace(/['"]/g, '').trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
const stripeSecretKey = envVars['STRIPE_SECRET_KEY'];

if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
  console.error("Error: Missing database or Stripe keys in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

// 2. Parse arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("\nUsage: node scripts/grant-beta-trial.js <club-id> [plan-tier] [trial-days]");
  console.log("Example: node scripts/grant-beta-trial.js 123e4567-e89b-12d3-a456-426614174000 pro 365\n");
  process.exit(1);
}

const clubId = args[0];
const planTier = args[1] || 'plus'; // 'plus' or 'pro'
const trialDays = parseInt(args[2] || '365', 10);

if (planTier !== 'plus' && planTier !== 'pro') {
  console.error("Error: plan-tier must be either 'plus' or 'pro'");
  process.exit(1);
}

async function run() {
  try {
    console.log(`Starting beta promo setup for Club: ${clubId}...`);
    console.log(`Plan Tier: ${planTier.toUpperCase()} | Trial Duration: ${trialDays} Days`);

    // 1. Fetch club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      console.error(`Error: Club not found:`, clubError?.message);
      process.exit(1);
    }
    console.log(`Found Club: "${club.name}"`);

    // 2. Resolve Price ID
    // We default to Monthly Price IDs so that when the 12 months end, they transition to monthly billing if they add a card.
    let priceIdEnvVar = planTier === 'pro' 
      ? 'NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY' 
      : 'NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_MONTHLY';

    const priceId = envVars[priceIdEnvVar];
    if (!priceId) {
      console.error(`Error: Price ID env var "${priceIdEnvVar}" not found in .env.local`);
      process.exit(1);
    }
    console.log(`Resolved Price ID: ${priceId}`);

    // 3. Count active teams for subscription quantity
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('club_id', clubId);
    
    const quantity = planTier === 'pro' ? 1 : (teams ? Math.max(1, teams.length) : 1);
    console.log(`Calculated subscription quantity: ${quantity} (based on ${teams?.length || 0} teams)`);

    // 4. Create or get Stripe Customer
    let stripeCustomerId = club.stripe_customer_id;
    if (!stripeCustomerId) {
      console.log("No Stripe Customer ID found on club. Creating customer in Stripe...");
      const customer = await stripe.customers.create({
        name: club.name,
        email: club.contact_email || undefined,
        metadata: {
          club_id: clubId,
          is_beta_user: 'true'
        }
      });
      stripeCustomerId = customer.id;
      console.log(`Created Stripe Customer: ${stripeCustomerId}`);

      // Update club with customer id
      const { error: updateCustError } = await supabase
        .from('clubs')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', clubId);

      if (updateCustError) {
        console.error("Warning: Failed to save stripe_customer_id to Supabase:", updateCustError.message);
      }
    } else {
      console.log(`Using existing Stripe Customer: ${stripeCustomerId}`);
    }

    // 5. Check if subscription already exists
    if (club.stripe_subscription_id) {
      console.log(`Warning: Club already has stripe_subscription_id: ${club.stripe_subscription_id}`);
      console.log("If they have an active subscription, creating a new one might double-bill them.");
      process.exit(1);
    }

    // 6. Create Stripe Subscription with Trial
    const trialEndTimestamp = Math.floor(Date.now() / 1000) + (trialDays * 24 * 60 * 60);
    console.log(`Creating Stripe Subscription with trial ending on: ${new Date(trialEndTimestamp * 1000).toLocaleString()}...`);

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{
        price: priceId,
        quantity: quantity,
      }],
      trial_end: trialEndTimestamp,
      metadata: {
        club_id: clubId,
        plan_tier: planTier,
      }
    });

    console.log(`Created Stripe Subscription: ${subscription.id} (Status: ${subscription.status})`);

    // 7. Update club record in Supabase
    const currentSettings = club.settings || {};
    const { error: finalUpdateError } = await supabase
      .from('clubs')
      .update({
        stripe_subscription_id: subscription.id,
        plan_tier: planTier,
        plan_interval: 'monthly',
        settings: {
          ...currentSettings,
          has_used_trial: true,
          cancel_at_period_end: false,
          promo_type: 'beta_12m',
          promo_granted_at: new Date().toISOString()
        }
      })
      .eq('id', clubId);

    if (finalUpdateError) {
      console.error(`Error updating club record:`, finalUpdateError.message);
      process.exit(1);
    }

    console.log(`\nSuccess! Club "${club.name}" upgraded to plan tier "${planTier}" for ${trialDays} days (trial subscription ${subscription.id}).`);
    process.exit(0);
  } catch (error) {
    console.error("Execution failed:", error);
    process.exit(1);
  }
}

run();
