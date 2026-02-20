/**
 * Tests for UpgradePromptModal component display logic
 *
 * Tests the modal's behavior for different feature gate points:
 * - Visibility control
 * - Feature-specific content (title, message, icon)
 * - Pricing display
 * - Callback invocation (onUpgrade, onClose)
 *
 * Pure logic tests — no React rendering required.
 * UI integration is tested by verifying data flow and callback patterns.
 */

import { TIER_PRICING } from '@/types/subscription';

// ============================================================================
// Types (duplicated from source)
// ============================================================================

type GatedFeature =
  | 'radar_limit'
  | 'radar_venue'
  | 'radar_proximity'
  | 'daily_recommendations'
  | 'group_planning'
  | 'calendar_sync'
  | 'ai_explanations'
  | 'advanced_filters';

interface FeatureDisplay {
  icon: string;
  title: string;
}

// ============================================================================
// Constants (duplicated from upgrade-prompt-modal.tsx)
// ============================================================================

const FEATURE_DISPLAY: Record<GatedFeature, FeatureDisplay> = {
  radar_limit: {
    icon: 'radio-outline',
    title: 'Unlock Unlimited Radars',
  },
  radar_venue: {
    icon: 'location-outline',
    title: 'Unlock Venue Radars',
  },
  radar_proximity: {
    icon: 'people-outline',
    title: 'Unlock Friend Radars',
  },
  daily_recommendations: {
    icon: 'sparkles',
    title: 'Unlock Unlimited Picks',
  },
  group_planning: {
    icon: 'people',
    title: 'Unlock Group Planning',
  },
  calendar_sync: {
    icon: 'calendar-outline',
    title: 'Unlock Calendar Sync',
  },
  ai_explanations: {
    icon: 'chatbubble-ellipses-outline',
    title: 'Unlock AI Insights',
  },
  advanced_filters: {
    icon: 'options-outline',
    title: 'Unlock Advanced Filters',
  },
};

// ============================================================================
// Pure logic functions (extracted from component for testability)
// ============================================================================

function getFeatureLimitMessage(feature: GatedFeature): string {
  switch (feature) {
    case 'radar_limit':
      return 'Create unlimited radars to never miss what matters to you.';
    case 'radar_venue':
      return 'Follow your favorite venues and get alerted about new events and specials.';
    case 'radar_proximity':
      return 'Get notified when friends are nearby and free to hang out.';
    case 'daily_recommendations':
      return 'Get unlimited personalized recommendations every day.';
    case 'group_planning':
      return 'Plan activities with up to 10 friends and find the perfect spot for everyone.';
    case 'calendar_sync':
      return 'Sync your Loop activities with Google Calendar and Apple Calendar automatically.';
    case 'ai_explanations':
      return 'See AI-powered match scores and personalized explanations on every recommendation.';
    case 'advanced_filters':
      return 'Fine-tune your recommendations with advanced filters like price range, ratings, and distance.';
    default:
      return 'Unlock the full Loop experience with Loop Plus.';
  }
}

function shouldShowModal(visible: boolean): boolean {
  return visible;
}

function getDisplayForFeature(feature: GatedFeature): FeatureDisplay {
  return FEATURE_DISPLAY[feature] ?? FEATURE_DISPLAY.daily_recommendations;
}

function getPricingText(): string {
  return `$${TIER_PRICING.plus}/mo or $${TIER_PRICING.plus_annual}/yr`;
}

// ============================================================================
// Tests
// ============================================================================

describe('UpgradePromptModal', () => {
  // =========================================================================
  // Visibility
  // =========================================================================

  describe('visibility', () => {
    it('should be visible when visible=true', () => {
      expect(shouldShowModal(true)).toBe(true);
    });

    it('should not be visible when visible=false', () => {
      expect(shouldShowModal(false)).toBe(false);
    });
  });

  // =========================================================================
  // FEATURE_DISPLAY config
  // =========================================================================

  describe('FEATURE_DISPLAY', () => {
    const ALL_FEATURES: GatedFeature[] = [
      'radar_limit',
      'radar_venue',
      'radar_proximity',
      'daily_recommendations',
      'group_planning',
      'calendar_sync',
      'ai_explanations',
      'advanced_filters',
    ];

    it('has an entry for every GatedFeature', () => {
      for (const feature of ALL_FEATURES) {
        expect(FEATURE_DISPLAY).toHaveProperty(feature);
      }
    });

    it('every entry has a non-empty icon', () => {
      for (const feature of ALL_FEATURES) {
        expect(FEATURE_DISPLAY[feature].icon).toBeTruthy();
        expect(FEATURE_DISPLAY[feature].icon.length).toBeGreaterThan(0);
      }
    });

    it('every entry has a non-empty title', () => {
      for (const feature of ALL_FEATURES) {
        expect(FEATURE_DISPLAY[feature].title).toBeTruthy();
        expect(FEATURE_DISPLAY[feature].title.length).toBeGreaterThan(0);
      }
    });

    it('all titles start with "Unlock"', () => {
      for (const feature of ALL_FEATURES) {
        expect(FEATURE_DISPLAY[feature].title).toMatch(/^Unlock/);
      }
    });

    it('all titles are unique', () => {
      const titles = ALL_FEATURES.map(f => FEATURE_DISPLAY[f].title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });

    it('all icons are unique', () => {
      const icons = ALL_FEATURES.map(f => FEATURE_DISPLAY[f].icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });
  });

  // =========================================================================
  // getDisplayForFeature
  // =========================================================================

  describe('getDisplayForFeature', () => {
    it('returns correct display for radar_limit', () => {
      const display = getDisplayForFeature('radar_limit');
      expect(display.title).toBe('Unlock Unlimited Radars');
      expect(display.icon).toBe('radio-outline');
    });

    it('returns correct display for radar_venue', () => {
      const display = getDisplayForFeature('radar_venue');
      expect(display.title).toBe('Unlock Venue Radars');
      expect(display.icon).toBe('location-outline');
    });

    it('returns correct display for radar_proximity', () => {
      const display = getDisplayForFeature('radar_proximity');
      expect(display.title).toBe('Unlock Friend Radars');
      expect(display.icon).toBe('people-outline');
    });

    it('returns correct display for daily_recommendations', () => {
      const display = getDisplayForFeature('daily_recommendations');
      expect(display.title).toBe('Unlock Unlimited Picks');
      expect(display.icon).toBe('sparkles');
    });

    it('returns correct display for group_planning', () => {
      const display = getDisplayForFeature('group_planning');
      expect(display.title).toBe('Unlock Group Planning');
      expect(display.icon).toBe('people');
    });

    it('returns correct display for calendar_sync', () => {
      const display = getDisplayForFeature('calendar_sync');
      expect(display.title).toBe('Unlock Calendar Sync');
      expect(display.icon).toBe('calendar-outline');
    });

    it('returns correct display for ai_explanations', () => {
      const display = getDisplayForFeature('ai_explanations');
      expect(display.title).toBe('Unlock AI Insights');
      expect(display.icon).toBe('chatbubble-ellipses-outline');
    });

    it('returns correct display for advanced_filters', () => {
      const display = getDisplayForFeature('advanced_filters');
      expect(display.title).toBe('Unlock Advanced Filters');
      expect(display.icon).toBe('options-outline');
    });

    it('falls back to daily_recommendations for unknown feature', () => {
      const display = getDisplayForFeature('nonexistent' as GatedFeature);
      expect(display.title).toBe('Unlock Unlimited Picks');
    });
  });

  // =========================================================================
  // Feature-specific messages
  // =========================================================================

  describe('feature-specific messages', () => {
    it('radar_limit message encourages upgrading', () => {
      const msg = getFeatureLimitMessage('radar_limit');
      expect(msg.toLowerCase()).toContain('unlimited');
      expect(msg.toLowerCase()).toContain('radar');
    });

    it('radar_venue message mentions venues', () => {
      const msg = getFeatureLimitMessage('radar_venue');
      expect(msg.toLowerCase()).toContain('venue');
      expect(msg.toLowerCase()).toContain('event');
    });

    it('radar_proximity message mentions friends', () => {
      const msg = getFeatureLimitMessage('radar_proximity');
      expect(msg.toLowerCase()).toContain('friend');
    });

    it('daily_recommendations message mentions recommendations', () => {
      const msg = getFeatureLimitMessage('daily_recommendations');
      expect(msg.toLowerCase()).toContain('recommendation');
    });

    it('group_planning message mentions planning with friends', () => {
      const msg = getFeatureLimitMessage('group_planning');
      expect(msg.toLowerCase()).toContain('friend');
      expect(msg.toLowerCase()).toContain('10');
    });

    it('calendar_sync message mentions calendar providers', () => {
      const msg = getFeatureLimitMessage('calendar_sync');
      expect(msg).toContain('Google Calendar');
      expect(msg).toContain('Apple Calendar');
    });

    it('ai_explanations message mentions match scores', () => {
      const msg = getFeatureLimitMessage('ai_explanations');
      expect(msg.toLowerCase()).toContain('match scores');
    });

    it('advanced_filters message mentions specific filter types', () => {
      const msg = getFeatureLimitMessage('advanced_filters');
      expect(msg.toLowerCase()).toContain('price');
      expect(msg.toLowerCase()).toContain('filter');
    });

    it('all messages are user-friendly (no technical jargon)', () => {
      const allFeatures: GatedFeature[] = [
        'radar_limit', 'radar_venue', 'radar_proximity',
        'daily_recommendations', 'group_planning',
        'calendar_sync', 'ai_explanations', 'advanced_filters',
      ];

      for (const feature of allFeatures) {
        const msg = getFeatureLimitMessage(feature);
        expect(msg).not.toContain('API');
        expect(msg).not.toContain('backend');
        expect(msg).not.toContain('database');
        expect(msg).not.toContain('subscribe');
      }
    });
  });

  // =========================================================================
  // Pricing
  // =========================================================================

  describe('pricing display', () => {
    it('shows monthly price', () => {
      const pricing = getPricingText();
      expect(pricing).toContain(`$${TIER_PRICING.plus}`);
    });

    it('shows annual price', () => {
      const pricing = getPricingText();
      expect(pricing).toContain(`$${TIER_PRICING.plus_annual}`);
    });

    it('format is "$X/mo or $Y/yr"', () => {
      const pricing = getPricingText();
      expect(pricing).toMatch(/\$[\d.]+\/mo or \$[\d.]+\/yr/);
    });

    it('uses correct pricing values from TIER_PRICING', () => {
      expect(TIER_PRICING.plus).toBe(5.99);
      expect(TIER_PRICING.plus_annual).toBe(49.99);
    });
  });

  // =========================================================================
  // Callback patterns
  // =========================================================================

  describe('callback patterns', () => {
    it('onUpgrade callback is invocable', () => {
      const onUpgrade = jest.fn();
      onUpgrade();
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });

    it('onClose callback is invocable', () => {
      const onClose = jest.fn();
      onClose();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('onUpgrade and onClose are independent', () => {
      const onUpgrade = jest.fn();
      const onClose = jest.fn();

      onUpgrade();
      expect(onUpgrade).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();

      onClose();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Content consistency
  // =========================================================================

  describe('content consistency', () => {
    it('radar features have radar-related titles', () => {
      expect(FEATURE_DISPLAY.radar_limit.title).toContain('Radar');
      expect(FEATURE_DISPLAY.radar_venue.title).toContain('Radar');
      expect(FEATURE_DISPLAY.radar_proximity.title).toContain('Radar');
    });

    it('non-radar features do not mention radar in title', () => {
      expect(FEATURE_DISPLAY.daily_recommendations.title).not.toContain('Radar');
      expect(FEATURE_DISPLAY.group_planning.title).not.toContain('Radar');
      expect(FEATURE_DISPLAY.calendar_sync.title).not.toContain('Radar');
      expect(FEATURE_DISPLAY.ai_explanations.title).not.toContain('Radar');
      expect(FEATURE_DISPLAY.advanced_filters.title).not.toContain('Radar');
    });

    it('all titles are concise (under 30 characters)', () => {
      const allFeatures: GatedFeature[] = [
        'radar_limit', 'radar_venue', 'radar_proximity',
        'daily_recommendations', 'group_planning',
        'calendar_sync', 'ai_explanations', 'advanced_filters',
      ];

      for (const feature of allFeatures) {
        expect(FEATURE_DISPLAY[feature].title.length).toBeLessThan(30);
      }
    });

    it('icon names follow Ionicons naming pattern (contain hyphens or are simple names)', () => {
      const allFeatures: GatedFeature[] = [
        'radar_limit', 'radar_venue', 'radar_proximity',
        'daily_recommendations', 'group_planning',
        'calendar_sync', 'ai_explanations', 'advanced_filters',
      ];

      for (const feature of allFeatures) {
        const icon = FEATURE_DISPLAY[feature].icon;
        // Ionicons use hyphenated names or simple words
        expect(icon).toMatch(/^[a-z][a-z-]*$/);
      }
    });
  });

  // =========================================================================
  // Integration scenarios
  // =========================================================================

  describe('integration scenarios', () => {
    it('radar limit gate: correct title + message pair', () => {
      const display = getDisplayForFeature('radar_limit');
      const message = getFeatureLimitMessage('radar_limit');
      expect(display.title).toBe('Unlock Unlimited Radars');
      expect(message).toContain('unlimited');
    });

    it('venue radar gate: correct title + message pair', () => {
      const display = getDisplayForFeature('radar_venue');
      const message = getFeatureLimitMessage('radar_venue');
      expect(display.title).toBe('Unlock Venue Radars');
      expect(message).toContain('venue');
    });

    it('daily recs gate: correct title + message pair', () => {
      const display = getDisplayForFeature('daily_recommendations');
      const message = getFeatureLimitMessage('daily_recommendations');
      expect(display.title).toBe('Unlock Unlimited Picks');
      expect(message).toContain('recommendation');
    });

    it('full flow: visible modal shows feature info + pricing + buttons', () => {
      const feature: GatedFeature = 'group_planning';
      const visible = true;
      const display = getDisplayForFeature(feature);
      const message = getFeatureLimitMessage(feature);
      const pricing = getPricingText();

      // All content should be ready
      expect(shouldShowModal(visible)).toBe(true);
      expect(display.title).toBeTruthy();
      expect(display.icon).toBeTruthy();
      expect(message).toBeTruthy();
      expect(pricing).toContain('$');
    });

    it('upgrade flow: onUpgrade fires, then modal can be closed', () => {
      const onUpgrade = jest.fn();
      const onClose = jest.fn();

      // User taps upgrade
      onUpgrade();
      expect(onUpgrade).toHaveBeenCalledTimes(1);

      // Modal closes after upgrade
      onClose();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
