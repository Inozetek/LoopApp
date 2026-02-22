/**
 * Supabase Edge Function: stripe-checkout
 *
 * Handles all Stripe operations server-side. This function is the ONLY place
 * that uses the Stripe secret key.
 *
 * Deployment:
 *   1. Install Supabase CLI: npm i -g supabase
 *   2. Link project:         supabase link --project-ref <your-project-ref>
 *   3. Set secrets:
 *        supabase secrets set STRIPE_SECRET_KEY=sk_test_...
 *        supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   4. Deploy:               supabase functions deploy stripe-checkout
 *
 * Environment variables (set via `supabase secrets set`):
 *   - STRIPE_SECRET_KEY       — Stripe secret key (sk_test_... or sk_live_...)
 *   - STRIPE_WEBHOOK_SECRET   — Stripe webhook signing secret (whsec_...)
 *
 * The function reads the Supabase service role key from the built-in
 * SUPABASE_SERVICE_ROLE_KEY environment variable to update user/business records.
 *
 * Actions handled:
 *   - create_user_checkout       Create checkout for Loop Plus subscription
 *   - create_business_checkout   Create checkout for business tier subscription
 *   - cancel_user_subscription   Cancel user subscription (end of period)
 *   - cancel_business_subscription  Cancel business subscription
 *   - create_portal_session      Open Stripe Customer Portal
 *   - restore_subscription       Verify subscription from Stripe
 */

// NOTE: This is a Deno Edge Function. It uses Deno-style imports.
// When deployed to Supabase, these imports resolve automatically.

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Stripe (will fail gracefully if key not set)
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
  : null;

// Initialize Supabase admin client (service role for writing to DB)
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

// ---------------------------------------------------------------------------
// CORS headers for Expo client
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Validate Stripe is configured
  if (!stripe) {
    return jsonResponse(
      {
        error:
          'Stripe is not configured. Set STRIPE_SECRET_KEY via supabase secrets set.',
      },
      500,
    );
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case 'create_user_checkout':
        return await handleCreateUserCheckout(params);

      case 'create_business_checkout':
        return await handleCreateBusinessCheckout(params);

      case 'cancel_user_subscription':
        return await handleCancelUserSubscription(params);

      case 'cancel_business_subscription':
        return await handleCancelBusinessSubscription(params);

      case 'create_portal_session':
        return await handleCreatePortalSession(params);

      case 'restore_subscription':
        return await handleRestoreSubscription(params);

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[stripe-checkout] Unhandled error:', err);
    return jsonResponse(
      { error: 'Internal server error. Please try again.' },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout session for a Loop Plus user subscription.
 */
async function handleCreateUserCheckout(params: {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const { userId, priceId, successUrl, cancelUrl } = params;

  if (!userId || !priceId) {
    return jsonResponse({ error: 'Missing userId or priceId' }, 400);
  }

  // Get or create Stripe customer for this user
  const customerId = await getOrCreateCustomerForUser(userId);
  if (!customerId) {
    return jsonResponse({ error: 'Failed to create Stripe customer' }, 500);
  }

  const session = await stripe!.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 7, // 7-day free trial for Loop Plus
      metadata: {
        user_id: userId,
        subscription_type: 'user',
      },
    },
    metadata: {
      user_id: userId,
      subscription_type: 'user',
    },
  });

  return jsonResponse({ url: session.url });
}

/**
 * Create a Stripe Checkout session for a business tier subscription.
 */
async function handleCreateBusinessCheckout(params: {
  businessId: string;
  priceId: string;
  tier: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const { businessId, priceId, tier, successUrl, cancelUrl } = params;

  if (!businessId || !priceId) {
    return jsonResponse({ error: 'Missing businessId or priceId' }, 400);
  }

  // Get or create Stripe customer for this business
  const customerId = await getOrCreateCustomerForBusiness(businessId);
  if (!customerId) {
    return jsonResponse({ error: 'Failed to create Stripe customer' }, 500);
  }

  const session = await stripe!.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 30, // 30-day free trial for businesses
      metadata: {
        business_id: businessId,
        subscription_type: 'business',
        tier,
      },
    },
    metadata: {
      business_id: businessId,
      subscription_type: 'business',
      tier,
    },
  });

  return jsonResponse({ url: session.url });
}

/**
 * Cancel a user's subscription at the end of the current billing period.
 */
async function handleCancelUserSubscription(params: { userId: string }) {
  const { userId } = params;

  if (!userId) {
    return jsonResponse({ error: 'Missing userId' }, 400);
  }

  // Look up the user's stripe_customer_id
  const { data: user } = await supabaseAdmin!
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.stripe_customer_id) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  // Find active subscriptions for this customer
  const subscriptions = await stripe!.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  // Cancel at end of period (user keeps access until then)
  await stripe!.subscriptions.update(subscriptions.data[0].id, {
    cancel_at_period_end: true,
  });

  // Update local DB
  await supabaseAdmin!
    .from('users')
    .update({ subscription_status: 'cancelled' })
    .eq('id', userId);

  return jsonResponse({ success: true });
}

/**
 * Cancel a business subscription at the end of the current billing period.
 */
async function handleCancelBusinessSubscription(params: {
  businessId: string;
}) {
  const { businessId } = params;

  if (!businessId) {
    return jsonResponse({ error: 'Missing businessId' }, 400);
  }

  // Look up the business stripe_subscription_id
  const { data: business } = await supabaseAdmin!
    .from('business_profiles')
    .select('stripe_subscription_id')
    .eq('id', businessId)
    .maybeSingle();

  if (!business?.stripe_subscription_id) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  // Cancel at end of period
  await stripe!.subscriptions.update(business.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Update local DB
  await supabaseAdmin!
    .from('business_profiles')
    .update({ business_subscription_status: 'cancelled' })
    .eq('id', businessId);

  return jsonResponse({ success: true });
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 */
async function handleCreatePortalSession(params: {
  userId: string;
  returnUrl: string;
}) {
  const { userId, returnUrl } = params;

  if (!userId) {
    return jsonResponse({ error: 'Missing userId' }, 400);
  }

  // Look up the user's stripe_customer_id
  const { data: user } = await supabaseAdmin!
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.stripe_customer_id) {
    return jsonResponse(
      { error: 'No Stripe customer found. Subscribe first.' },
      404,
    );
  }

  const session = await stripe!.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: returnUrl,
  });

  return jsonResponse({ url: session.url });
}

/**
 * Restore / verify a user's subscription status directly from Stripe.
 */
async function handleRestoreSubscription(params: { userId: string }) {
  const { userId } = params;

  if (!userId) {
    return jsonResponse({ error: 'Missing userId' }, 400);
  }

  // Look up the user's stripe_customer_id
  const { data: user } = await supabaseAdmin!
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.stripe_customer_id) {
    return jsonResponse({ tier: 'free', status: 'none' });
  }

  // Check for active subscriptions
  const subscriptions = await stripe!.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    // Check for trialing subscriptions
    const trialingSubs = await stripe!.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'trialing',
      limit: 1,
    });

    if (trialingSubs.data.length === 0) {
      // No active or trialing subscription — reset to free
      await supabaseAdmin!
        .from('users')
        .update({ subscription_tier: 'free', subscription_status: 'active' })
        .eq('id', userId);

      return jsonResponse({ tier: 'free', status: 'none' });
    }

    // Has trialing subscription
    const sub = trialingSubs.data[0];
    const tier =
      (sub.metadata?.subscription_type === 'user' ? 'plus' : 'free') as string;

    await supabaseAdmin!
      .from('users')
      .update({
        subscription_tier: tier,
        subscription_status: 'trialing',
        subscription_end_date: new Date(
          sub.current_period_end * 1000,
        ).toISOString(),
      })
      .eq('id', userId);

    return jsonResponse({ tier, status: 'trialing' });
  }

  // Has active subscription
  const sub = subscriptions.data[0];
  const tier =
    (sub.metadata?.subscription_type === 'user' ? 'plus' : 'free') as string;

  await supabaseAdmin!
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: 'active',
      subscription_end_date: new Date(
        sub.current_period_end * 1000,
      ).toISOString(),
    })
    .eq('id', userId);

  return jsonResponse({ tier, status: 'active' });
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get or create a Stripe Customer for a Supabase user.
 */
async function getOrCreateCustomerForUser(
  userId: string,
): Promise<string | null> {
  try {
    // Check if user already has a Stripe customer ID
    const { data: user } = await supabaseAdmin!
      .from('users')
      .select('stripe_customer_id, email, name')
      .eq('id', userId)
      .maybeSingle();

    if (user?.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    if (!user) {
      console.error(`[stripe-checkout] User ${userId} not found`);
      return null;
    }

    // Create a new Stripe customer
    const customer = await stripe!.customers.create({
      email: user.email,
      name: user.name,
      metadata: { supabase_user_id: userId },
    });

    // Save the customer ID back to the user record
    await supabaseAdmin!
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    return customer.id;
  } catch (err) {
    console.error('[stripe-checkout] Error creating customer for user:', err);
    return null;
  }
}

/**
 * Get or create a Stripe Customer for a business profile.
 */
async function getOrCreateCustomerForBusiness(
  businessId: string,
): Promise<string | null> {
  try {
    // Check if business already has a Stripe subscription ID
    // We use user_id to look up stripe_customer_id on the users table
    const { data: business } = await supabaseAdmin!
      .from('business_profiles')
      .select('user_id, business_name')
      .eq('id', businessId)
      .maybeSingle();

    if (!business) {
      console.error(
        `[stripe-checkout] Business ${businessId} not found`,
      );
      return null;
    }

    // Get the user's stripe customer ID
    const { data: user } = await supabaseAdmin!
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', business.user_id)
      .maybeSingle();

    if (user?.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    if (!user) {
      console.error(
        `[stripe-checkout] User for business ${businessId} not found`,
      );
      return null;
    }

    // Create a new Stripe customer
    const customer = await stripe!.customers.create({
      email: user.email,
      name: business.business_name,
      metadata: {
        supabase_user_id: business.user_id,
        business_id: businessId,
      },
    });

    // Save the customer ID to the user record
    await supabaseAdmin!
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', business.user_id);

    return customer.id;
  } catch (err) {
    console.error(
      '[stripe-checkout] Error creating customer for business:',
      err,
    );
    return null;
  }
}

/**
 * Create a JSON response with CORS headers.
 */
function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
