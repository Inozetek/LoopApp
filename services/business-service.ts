/**
 * Business Service Layer
 *
 * Provides data fetching and tracking for business accounts.
 */

import { supabase } from '@/lib/supabase';
import type { BusinessProfile, BusinessDailyAnalytics } from '@/types/database';

export interface BusinessOverview {
  totalImpressions: number;
  totalClicks: number;
  totalCalendarAdds: number;
  clickThroughRate: number;
  recentTrend: 'up' | 'down' | 'stable';
}

export async function getBusinessProfile(userId: string): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching business profile:', error);
    return null;
  }
  return data;
}

export async function updateBusinessProfile(
  userId: string,
  data: Partial<BusinessProfile>
): Promise<void> {
  const { error } = await supabase
    .from('business_profiles')
    .update(data)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getBusinessAnalytics(
  profileId: string,
  days: number = 30
): Promise<BusinessDailyAnalytics[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('business_daily_analytics')
    .select('*')
    .eq('business_profile_id', profileId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching business analytics:', error);
    return [];
  }
  return data || [];
}

export async function getBusinessOverview(profileId: string): Promise<BusinessOverview> {
  const analytics = await getBusinessAnalytics(profileId, 30);

  const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = analytics.reduce((sum, a) => sum + a.clicks, 0);
  const totalCalendarAdds = analytics.reduce((sum, a) => sum + a.calendar_adds, 0);
  const clickThroughRate = totalImpressions > 0
    ? Math.round((totalClicks / totalImpressions) * 1000) / 10
    : 0;

  // Determine trend: compare last 7 days to previous 7 days
  const recentDays = analytics.slice(-7);
  const previousDays = analytics.slice(-14, -7);
  const recentImpressions = recentDays.reduce((s, a) => s + a.impressions, 0);
  const previousImpressions = previousDays.reduce((s, a) => s + a.impressions, 0);

  let recentTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentImpressions > previousImpressions * 1.1) recentTrend = 'up';
  else if (recentImpressions < previousImpressions * 0.9) recentTrend = 'down';

  return { totalImpressions, totalClicks, totalCalendarAdds, clickThroughRate, recentTrend };
}

export async function trackImpression(businessProfileId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Upsert daily analytics row
  const { error } = await supabase.rpc('increment_business_analytics', {
    p_profile_id: businessProfileId,
    p_date: today,
    p_field: 'impressions',
  }).catch(() => {
    // Fallback: manual upsert if RPC doesn't exist
    return supabase
      .from('business_daily_analytics')
      .upsert(
        { business_profile_id: businessProfileId, date: today, impressions: 1 },
        { onConflict: 'business_profile_id,date' }
      );
  });

  // Also increment denormalized counter
  await supabase.rpc('increment_field', {
    table_name: 'business_profiles',
    field_name: 'total_impressions',
    row_id: businessProfileId,
  }).catch((err: unknown) => {
    console.warn('[business] increment_field(total_impressions) failed:', (err as Error)?.message);
  });
}

export async function trackClick(businessProfileId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await supabase
    .from('business_daily_analytics')
    .upsert(
      { business_profile_id: businessProfileId, date: today, clicks: 1 },
      { onConflict: 'business_profile_id,date' }
    ).catch((err: unknown) => {
      console.warn('[business] trackClick upsert failed:', (err as Error)?.message);
    });
}

export async function trackCalendarAdd(businessProfileId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await supabase
    .from('business_daily_analytics')
    .upsert(
      { business_profile_id: businessProfileId, date: today, calendar_adds: 1 },
      { onConflict: 'business_profile_id,date' }
    ).catch((err: unknown) => {
      console.warn('[business] trackCalendarAdd upsert failed:', (err as Error)?.message);
    });
}
