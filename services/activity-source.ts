/**
 * Activity Source Abstraction Layer
 *
 * Provides a unified interface for fetching activities from multiple sources:
 * - Google Places API (existing)
 * - Ticketmaster API (events)
 * - Yelp Fusion API (enhanced ratings)
 *
 * Key Design Principles:
 * 1. Source-agnostic: All sources implement same interface
 * 2. Graceful degradation: If one API fails, others still work
 * 3. Feature-flagged: Easy to enable/disable individual sources
 * 4. Parallel execution: API calls run concurrently for performance
 */

import { FEATURE_FLAGS } from '@/constants/feature-flags';
import type {
  UnifiedActivity,
  ActivitySource,
  SearchParams,
} from '@/types/activity';

/**
 * Common interface that all activity sources must implement
 */
export interface IActivitySource {
  /** Source identifier */
  readonly name: ActivitySource;

  /**
   * Search for activities near a location
   * @param params Search parameters (location, radius, interests, etc.)
   * @returns Array of unified activities from this source
   */
  search(params: SearchParams): Promise<UnifiedActivity[]>;

  /**
   * Get detailed information about a specific activity
   * @param id Activity identifier (can be Google Place ID, Ticketmaster event ID, etc.)
   * @returns Activity details or null if not found
   */
  getDetails(id: string): Promise<UnifiedActivity | null>;

  /**
   * Check if this source is available (feature flag enabled + API key configured)
   * @returns True if source is ready to use
   */
  isAvailable(): boolean;
}

/**
 * Registry that manages all activity sources and coordinates multi-source searches
 */
export class ActivitySourceRegistry {
  private sources: Map<ActivitySource, IActivitySource> = new Map();

  /**
   * Register a new activity source
   */
  register(source: IActivitySource): void {
    this.sources.set(source.name, source);
  }

  /**
   * Unregister an activity source
   */
  unregister(sourceName: ActivitySource): void {
    this.sources.delete(sourceName);
  }

  /**
   * Get a specific source by name
   */
  getSource(sourceName: ActivitySource): IActivitySource | undefined {
    return this.sources.get(sourceName);
  }

  /**
   * Get all available sources (feature flag enabled + API key present)
   */
  getAvailableSources(): IActivitySource[] {
    console.log(`[ActivitySourceRegistry] Total registered sources: ${this.sources.size}`);
    const allSources = Array.from(this.sources.values());
    console.log(`[ActivitySourceRegistry] Registered source names:`, allSources.map(s => s.name).join(', '));

    const availableSources = allSources.filter(source => {
      const isAvailable = source.isAvailable();
      console.log(`[ActivitySourceRegistry] ${source.name}.isAvailable() = ${isAvailable}`);
      return isAvailable;
    });

    console.log(`[ActivitySourceRegistry] Available sources:`, availableSources.map(s => s.name).join(', '));
    return availableSources;
  }

  /**
   * Search all available sources in parallel
   *
   * Key behaviors:
   * - Runs API calls concurrently for performance
   * - Gracefully handles individual source failures (logs error, continues)
   * - Returns combined results from all successful sources
   * - If ALL sources fail, returns empty array (doesn't crash app)
   *
   * @param params Search parameters
   * @returns Combined array of activities from all sources
   */
  async searchAll(params: SearchParams): Promise<UnifiedActivity[]> {
    const availableSources = this.getAvailableSources();

    if (availableSources.length === 0) {
      console.warn('[ActivitySourceRegistry] No available sources configured');
      return [];
    }

    console.log(
      `[ActivitySourceRegistry] Searching ${availableSources.length} sources:`,
      availableSources.map(s => s.name).join(', ')
    );

    // Execute all searches in parallel using Promise.allSettled
    // This ensures one failing API doesn't block others
    const results = await Promise.allSettled(
      availableSources.map(async source => {
        try {
          const startTime = Date.now();
          const activities = await source.search(params);
          const duration = Date.now() - startTime;

          console.log(
            `[ActivitySourceRegistry] ${source.name}: ${activities.length} results in ${duration}ms`
          );

          return activities;
        } catch (error) {
          console.error(`[ActivitySourceRegistry] ${source.name} search failed:`, error);
          // Return empty array on error (graceful degradation)
          return [];
        }
      })
    );

    // Flatten results from all successful API calls
    const activities: UnifiedActivity[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        activities.push(...result.value);
      } else {
        // Log rejected promises (shouldn't happen due to try/catch above, but defensive)
        console.error('[ActivitySourceRegistry] Promise rejected:', result.reason);
      }
    }

    console.log(`[ActivitySourceRegistry] Total results: ${activities.length}`);

    return activities;
  }

  /**
   * Search a specific source
   *
   * @param sourceName Name of the source to search
   * @param params Search parameters
   * @returns Activities from that source, or empty array if source unavailable
   */
  async searchSource(
    sourceName: ActivitySource,
    params: SearchParams
  ): Promise<UnifiedActivity[]> {
    const source = this.sources.get(sourceName);

    if (!source) {
      console.warn(`[ActivitySourceRegistry] Source not registered: ${sourceName}`);
      return [];
    }

    if (!source.isAvailable()) {
      console.warn(`[ActivitySourceRegistry] Source not available: ${sourceName}`);
      return [];
    }

    try {
      return await source.search(params);
    } catch (error) {
      console.error(`[ActivitySourceRegistry] ${sourceName} search failed:`, error);
      return [];
    }
  }

  /**
   * Get details from a specific source
   *
   * @param sourceName Name of the source
   * @param id Activity ID
   * @returns Activity details or null
   */
  async getDetailsFromSource(
    sourceName: ActivitySource,
    id: string
  ): Promise<UnifiedActivity | null> {
    const source = this.sources.get(sourceName);

    if (!source || !source.isAvailable()) {
      return null;
    }

    try {
      return await source.getDetails(id);
    } catch (error) {
      console.error(`[ActivitySourceRegistry] ${sourceName} getDetails failed:`, error);
      return null;
    }
  }

  /**
   * Get count of registered sources
   */
  getSourceCount(): number {
    return this.sources.size;
  }

  /**
   * Get count of available sources (enabled + configured)
   */
  getAvailableSourceCount(): number {
    return this.getAvailableSources().length;
  }
}

/**
 * Global registry instance (singleton)
 * Sources register themselves on import
 */
export const activitySources = new ActivitySourceRegistry();

/**
 * Helper: Check if mixed feed is enabled
 */
export function isMixedFeedEnabled(): boolean {
  return FEATURE_FLAGS.ENABLE_MIXED_FEED;
}

/**
 * Helper: Get list of enabled source names
 */
export function getEnabledSourceNames(): ActivitySource[] {
  const enabledSources: ActivitySource[] = [];

  // Google Places is always enabled (default)
  enabledSources.push('google_places');

  // Ticketmaster (if feature flag enabled)
  if (FEATURE_FLAGS.ENABLE_TICKETMASTER) {
    enabledSources.push('ticketmaster');
  }

  // Eventbrite (if feature flag enabled)
  if (FEATURE_FLAGS.ENABLE_EVENTBRITE) {
    enabledSources.push('eventbrite');
  }

  // Yelp (if feature flag enabled) - postponed, no free tier
  if (FEATURE_FLAGS.ENABLE_YELP) {
    enabledSources.push('yelp');
  }

  // Groupon (if feature flag enabled)
  if (FEATURE_FLAGS.ENABLE_GROUPON) {
    enabledSources.push('groupon');
  }

  return enabledSources;
}
