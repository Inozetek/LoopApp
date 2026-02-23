/**
 * Analytics Utility
 *
 * Event tracking with PostHog/Mixpanel integration hooks.
 * PostHog SDK will be wired in after native build compatibility is confirmed.
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: string;
  userId?: string;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private enabled: boolean;
  private provider: 'posthog' | 'mixpanel' | 'none' = 'none';

  constructor() {
    const hasPostHog = !!process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const hasMixpanel = !!process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

    if (hasPostHog) {
      this.provider = 'posthog';
      this.enabled = true;
      console.log('✅ Analytics ready (PostHog configured)');
    } else if (hasMixpanel) {
      this.provider = 'mixpanel';
      this.enabled = true;
      console.log('✅ Analytics ready (Mixpanel configured)');
    } else {
      this.enabled = process.env.NODE_ENV === 'production';
      console.log('ℹ️  Analytics running in console-only mode');
    }
  }

  /**
   * Track an event
   */
  track(event: string, properties?: Record<string, any>, userId?: string): void {
    if (!this.enabled) {
      console.log(`[Analytics] ${event}`, properties);
      return;
    }

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: new Date().toISOString(),
      userId,
    };

    this.events.push(analyticsEvent);
    this.logEvent(analyticsEvent);
  }

  /**
   * Identify user (call after login/signup)
   */
  identify(userId: string, _userProperties?: Record<string, any>): void {
    // PostHog SDK: ph.identify(userId, userProperties)
    console.log(`📊 [Analytics] identify: ${userId}`);
  }

  /**
   * Reset identity (call on logout)
   */
  reset(): void {
    // PostHog SDK: ph.reset()
    console.log('📊 [Analytics] identity reset');
  }

  trackSignUp(userId: string, method: 'email' | 'google' | 'apple'): void {
    this.identify(userId, { signup_method: method });
    this.track('user_signed_up', { method, timestamp: new Date().toISOString() }, userId);
  }

  trackLogin(userId: string, method: 'email' | 'google' | 'apple'): void {
    this.identify(userId, { last_login_method: method });
    this.track('user_logged_in', { method, timestamp: new Date().toISOString() }, userId);
  }

  trackActivityAdded(userId: string, activityCategory: string, source: 'recommendation' | 'manual'): void {
    this.track('activity_added_to_calendar', { category: activityCategory, source }, userId);
  }

  trackFriendRequestSent(userId: string): void {
    this.track('friend_request_sent', {}, userId);
  }

  trackFriendRequestAccepted(userId: string): void {
    this.track('friend_request_accepted', {}, userId);
  }

  trackFeedbackSubmitted(userId: string, rating: 'thumbs_up' | 'thumbs_down', activityCategory: string): void {
    this.track('feedback_submitted', { rating, category: activityCategory }, userId);
  }

  trackScreenView(userId: string, screenName: string): void {
    this.track('screen_view', { screen_name: screenName }, userId);
  }

  trackGroupPlanCreated(userId: string, participantCount: number): void {
    this.track('group_plan_created', { participant_count: participantCount }, userId);
  }

  trackRecommendationAcceptance(userId: string, accepted: boolean, score: number): void {
    this.track('recommendation_interaction', { accepted, confidence_score: score }, userId);
  }

  getSummary(): { totalEvents: number; eventTypes: Record<string, number> } {
    const eventTypes: Record<string, number> = {};
    this.events.forEach((event) => {
      eventTypes[event.event] = (eventTypes[event.event] || 0) + 1;
    });
    return { totalEvents: this.events.length, eventTypes };
  }

  private logEvent(event: AnalyticsEvent): void {
    if (__DEV__) {
      console.log(`📊 [Analytics] ${event.event}`, {
        properties: event.properties,
        userId: event.userId,
      });
    }

    if (this.enabled && this.provider !== 'none') {
      console.log(`📤 [${this.provider}] Event ready to send: ${event.event}`);
    }
  }

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
}

export const analytics = new Analytics();

export const trackEvent = (event: string, properties?: Record<string, any>, userId?: string) => {
  analytics.track(event, properties, userId);
};

export const trackSignUp = (userId: string, method: 'email' | 'google' | 'apple') => {
  analytics.trackSignUp(userId, method);
};

export const trackLogin = (userId: string, method: 'email' | 'google' | 'apple') => {
  analytics.trackLogin(userId, method);
};

export const trackActivityAdded = (userId: string, category: string, source: 'recommendation' | 'manual') => {
  analytics.trackActivityAdded(userId, category, source);
};

export const trackFriendRequest = (userId: string, action: 'sent' | 'accepted') => {
  if (action === 'sent') {
    analytics.trackFriendRequestSent(userId);
  } else {
    analytics.trackFriendRequestAccepted(userId);
  }
};

export const trackFeedback = (userId: string, rating: 'thumbs_up' | 'thumbs_down', category: string) => {
  analytics.trackFeedbackSubmitted(userId, rating, category);
};
