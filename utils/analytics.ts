/**
 * Analytics Utility
 *
 * Event tracking with PostHog/Mixpanel integration hooks.
 * Ready for Phase 2 integration - just install the SDK and uncomment.
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
    // Enable analytics in production OR if env vars are set
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
      // In development, just log to console
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

    // In MVP, just store in memory
    // Phase 2: Send to analytics service (Posthog, Mixpanel, etc.)
    this.logEvent(analyticsEvent);
  }

  /**
   * Track user sign up
   */
  trackSignUp(userId: string, method: 'email' | 'google' | 'apple'): void {
    this.track('user_signed_up', {
      method,
      timestamp: new Date().toISOString(),
    }, userId);
  }

  /**
   * Track user login
   */
  trackLogin(userId: string, method: 'email' | 'google' | 'apple'): void {
    this.track('user_logged_in', {
      method,
      timestamp: new Date().toISOString(),
    }, userId);
  }

  /**
   * Track activity added to calendar
   */
  trackActivityAdded(userId: string, activityCategory: string, source: 'recommendation' | 'manual'): void {
    this.track('activity_added_to_calendar', {
      category: activityCategory,
      source,
    }, userId);
  }

  /**
   * Track friend request sent
   */
  trackFriendRequestSent(userId: string): void {
    this.track('friend_request_sent', {}, userId);
  }

  /**
   * Track friend request accepted
   */
  trackFriendRequestAccepted(userId: string): void {
    this.track('friend_request_accepted', {}, userId);
  }

  /**
   * Track feedback submitted
   */
  trackFeedbackSubmitted(userId: string, rating: 'thumbs_up' | 'thumbs_down', activityCategory: string): void {
    this.track('feedback_submitted', {
      rating,
      category: activityCategory,
    }, userId);
  }

  /**
   * Track screen view
   */
  trackScreenView(userId: string, screenName: string): void {
    this.track('screen_view', {
      screen_name: screenName,
    }, userId);
  }

  /**
   * Track group plan created
   */
  trackGroupPlanCreated(userId: string, participantCount: number): void {
    this.track('group_plan_created', {
      participant_count: participantCount,
    }, userId);
  }

  /**
   * Track recommendation acceptance rate
   */
  trackRecommendationAcceptance(userId: string, accepted: boolean, score: number): void {
    this.track('recommendation_interaction', {
      accepted,
      confidence_score: score,
    }, userId);
  }

  /**
   * Get analytics summary (for debugging)
   */
  getSummary(): { totalEvents: number; eventTypes: Record<string, number> } {
    const eventTypes: Record<string, number> = {};

    this.events.forEach((event) => {
      eventTypes[event.event] = (eventTypes[event.event] || 0) + 1;
    });

    return {
      totalEvents: this.events.length,
      eventTypes,
    };
  }

  /**
   * Log event to console (development) or send to service (production)
   */
  private logEvent(event: AnalyticsEvent): void {
    // Always log in development
    if (process.env.NODE_ENV === 'development' || __DEV__) {
      console.log(`📊 [Analytics] ${event.event}`, {
        properties: event.properties,
        userId: event.userId,
      });
    }

    // Send to analytics service in production
    if (this.enabled && this.provider !== 'none') {
      // TODO: Phase 2 - Install SDK and uncomment:
      //
      // PostHog:
      // import posthog from 'posthog-react-native'
      // posthog.capture(event.event, { ...event.properties, distinct_id: event.userId });
      //
      // Mixpanel:
      // import { Mixpanel } from 'mixpanel-react-native'
      // Mixpanel.getInstance().track(event.event, event.properties);
      // if (event.userId) Mixpanel.getInstance().identify(event.userId);

      console.log(`📤 [${this.provider}] Event ready to send: ${event.event}`);
    }
  }

  /**
   * Enable analytics manually (for testing)
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable analytics
   */
  disable(): void {
    this.enabled = false;
  }
}

// Export singleton instance
export const analytics = new Analytics();

/**
 * Helper functions for common tracking
 */
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
