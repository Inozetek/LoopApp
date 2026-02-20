/**
 * useMessagesUnread Hook
 *
 * Returns the total unread message count for the current user.
 * Polls periodically to keep the badge count fresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getUnreadCount } from '@/services/chat-service';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Returns the total unread message count across all conversations.
 * Polls every 30 seconds while the user is logged in.
 */
export function useMessagesUnread(): number {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getUnreadCount(user.id);
      setUnreadCount(count);
    } catch {
      // Silently fail — badge will show stale count
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return unreadCount;
}
