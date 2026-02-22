/**
 * Supabase Edge Function: stripe-webhook
 *
 * Handles Stripe webhook events to keep the local database in sync
 * with Stripe subscription state.
 *
 * Deployment:
 *   1. Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
 *   2. Set secrets:
 *        supabase secrets set STRIPE_SECRET_KEY=sk_test_...
 *        supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   3. In Stripe Dashboard -> Webhooks, add endpoint:
 *        https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 *      Subscribe to events:
 *        - checkout.session.completed
 *        - customer.subscription.created
 *        - customer.subscription.updated
 *        - customer.subscription.deleted
 *        - invoice.payment_succeeded
 *        - invoice.payment_failed
 *
 * IMPORTANT: Deploy with --no-verify-jwt since Stripe sends webhooks
 * without a Supabase auth token.
 */

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return new Response('Webhook signature verification failed', {
      status: 400,
    });
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    // Return 200 so Stripe doesn't retry — we log the error for investigation
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle checkout.session.completed — subscription was successfully created.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const subscriptionType = session.metadata?.subscription_type;
  const userId = session.metadata?.user_id;
  const businessId = session.metadata?.business_id;

  console.log(
    `[stripe-webhook] Checkout completed: type=${subscriptionType}, user=${userId}, business=${businessId}`,
  );

  // The subscription.created/updated event will handle the actual DB update.
  // This handler is useful for any one-time post-checkout logic.
}

/**
 * Handle customer.subscription.created or customer.subscription.updated.
 * Updates the local DB to reflect the current subscription state.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.subscription_type;
  const status = mapStripeStatus(subscription.status);
  const periodEnd = new Date(
    subscription.current_period_end * 1000,
  ).toISOString();

  if (subscriptionType === 'user') {
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      console.error('[stripe-webhook] Missing user_id in subscription metadata');
      return;
    }

    await supabaseAdmin
      .from('users')
      .update({
        subscription_tier: 'plus',
        subscription_status: status,
        subscription_end_date: periodEnd,
      })
      .eq('id', userId);

    console.log(
      `[stripe-webhook] Updated user ${userId}: tier=plus, status=${status}`,
    );
  } else if (subscriptionType === 'business') {
    const businessId = subscription.metadata?.business_id;
    const tier = subscription.metadata?.tier || 'boosted';

    if (!businessId) {
      console.error(
        '[stripe-webhook] Missing business_id in subscription metadata',
      );
      return;
    }

    await supabaseAdmin
      .from('business_profiles')
      .update({
        business_tier: tier,
        business_subscription_status: status,
        stripe_subscription_id: subscription.id,
      })
      .eq('id', businessId);

    console.log(
      `[stripe-webhook] Updated business ${businessId}: tier=${tier}, status=${status}`,
    );
  }
}

/**
 * Handle customer.subscription.deleted — subscription was cancelled or expired.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.subscription_type;

  if (subscriptionType === 'user') {
    const userId = subscription.metadata?.user_id;
    if (!userId) return;

    await supabaseAdmin
      .from('users')
      .update({
        subscription_tier: 'free',
        subscription_status: 'active', // Reset to active-free state
        subscription_end_date: null,
      })
      .eq('id', userId);

    console.log(`[stripe-webhook] User ${userId} subscription deleted -> free`);
  } else if (subscriptionType === 'business') {
    const businessId = subscription.metadata?.business_id;
    if (!businessId) return;

    await supabaseAdmin
      .from('business_profiles')
      .update({
        business_tier: 'organic',
        business_subscription_status: 'inactive',
        stripe_subscription_id: null,
      })
      .eq('id', businessId);

    console.log(
      `[stripe-webhook] Business ${businessId} subscription deleted -> organic`,
    );
  }
}

/**
 * Handle invoice.payment_failed — subscription payment failed.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  // Fetch the subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionType = subscription.metadata?.subscription_type;

  if (subscriptionType === 'user') {
    const userId = subscription.metadata?.user_id;
    if (!userId) return;

    await supabaseAdmin
      .from('users')
      .update({ subscription_status: 'past_due' })
      .eq('id', userId);

    console.log(
      `[stripe-webhook] User ${userId} payment failed -> past_due`,
    );
  } else if (subscriptionType === 'business') {
    const businessId = subscription.metadata?.business_id;
    if (!businessId) return;

    await supabaseAdmin
      .from('business_profiles')
      .update({ business_subscription_status: 'past_due' })
      .eq('id', businessId);

    console.log(
      `[stripe-webhook] Business ${businessId} payment failed -> past_due`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map Stripe subscription status to our local status enum.
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'active' | 'cancelled' | 'past_due' | 'trialing' {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'cancelled';
    default:
      return 'cancelled';
  }
}
