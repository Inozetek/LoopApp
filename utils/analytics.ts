/**
 * Basic Analytics Utility
 *
 * Simple event tracking for MVP.
 * In Phase 2, replace with Posthog or Mixpanel.
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

  constructor() {
    // Enable analytics only in production
    this.enabled = process.env.NODE_ENV === 'production';
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
    // MVP: Just log to console
    console.log(`[Analytics Event] ${event.event}`, {
      properties: event.properties,
      userId: event.userId,
      timestamp: event.timestamp,
    });

    // Phase 2: Send to analytics service
    // Example with Posthog:
    // posthog.capture(event.event, event.properties);
    //
    // Example with Mixpanel:
    // mixpanel.track(event.event, event.properties);
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
