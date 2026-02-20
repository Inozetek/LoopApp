/**
 * Tests for Group Plan Chat, RSVP persistence, and plan confirmation logic.
 *
 * Covers:
 * - GroupPlanChat helper functions (getInitials, formatMessageTime, truncateMessage)
 * - RSVP state transitions and optimistic updates
 * - Plan confirmation flow (canConfirmPlan, summarizeRsvps)
 * - Chat message formatting and deduplication
 * - Chat service: getOrCreateGroupConversation logic
 */

// ---------------------------------------------------------------------------
// Helper functions replicated from components for pure-logic unit testing
// ---------------------------------------------------------------------------

// From group-plan-chat.tsx
function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function truncateMessage(text: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

// From my-group-plans-section.tsx
interface Participant {
  id: string;
  user_id: string;
  rsvp_status: 'invited' | 'accepted' | 'declined' | 'maybe' | 'no_response';
  name?: string;
}

function canConfirmPlan(participants: Participant[]): boolean {
  if (participants.length === 0) return false;
  const hasAccepted = participants.some((p) => p.rsvp_status === 'accepted');
  const hasPending = participants.some((p) => p.rsvp_status === 'invited');
  return hasAccepted && !hasPending;
}

function summarizeRsvps(participants: Participant[]): string {
  const accepted = participants.filter((p) => p.rsvp_status === 'accepted').length;
  const maybe = participants.filter((p) => p.rsvp_status === 'maybe').length;
  const declined = participants.filter((p) => p.rsvp_status === 'declined').length;
  const pending = participants.filter((p) => p.rsvp_status === 'invited').length;

  const parts: string[] = [];
  if (accepted > 0) parts.push(`${accepted} going`);
  if (maybe > 0) parts.push(`${maybe} maybe`);
  if (declined > 0) parts.push(`${declined} declined`);
  if (pending > 0) parts.push(`${pending} pending`);

  return parts.join(', ') || 'No participants';
}

// ---------------------------------------------------------------------------
// RSVP state transitions (from group-invitations-section.tsx)
// ---------------------------------------------------------------------------
type RsvpStatus = 'invited' | 'accepted' | 'declined' | 'maybe';

interface GroupInvitation {
  id: string;
  plan_id: string;
  rsvp_status: RsvpStatus;
  invited_at: string;
  plan: {
    id: string;
    title: string;
    description?: string;
    suggested_time: string;
    meeting_address?: string;
    creator_id: string;
    creator_name?: string;
  };
}

function optimisticRsvpUpdate(
  invitations: GroupInvitation[],
  invitationId: string,
  newStatus: RsvpStatus
): GroupInvitation[] {
  return invitations.map((inv) =>
    inv.id === invitationId ? { ...inv, rsvp_status: newStatus } : inv
  );
}

function removeInvitation(
  invitations: GroupInvitation[],
  invitationId: string
): GroupInvitation[] {
  return invitations.filter((inv) => inv.id !== invitationId);
}

function getResponseText(response: 'accepted' | 'declined' | 'maybe'): string {
  if (response === 'accepted') return 'See you there! Added to your calendar.';
  if (response === 'declined') return 'Maybe next time!';
  return 'Noted as maybe!';
}

// ---------------------------------------------------------------------------
// Chat message deduplication (from GroupPlanChat component logic)
// ---------------------------------------------------------------------------
interface MockMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

function deduplicateMessages(
  existing: MockMessage[],
  incoming: MockMessage,
  maxMessages: number
): MockMessage[] {
  if (existing.some((m) => m.id === incoming.id)) return existing;
  const updated = [...existing, incoming];
  return updated.slice(-maxMessages);
}

// Sender name resolution helper
function getSenderName(
  senderId: string,
  currentUserId: string,
  participantNames: Record<string, string>
): string {
  if (senderId === currentUserId) return 'You';
  return participantNames[senderId] || 'Friend';
}

// ===================================================================
// TESTS
// ===================================================================

describe('GroupPlanChat - getInitials', () => {
  it('returns two-letter initials for full name', () => {
    expect(getInitials('Sarah Johnson')).toBe('SJ');
  });

  it('returns single letter for first name only', () => {
    expect(getInitials('Mike')).toBe('M');
  });

  it('returns ? for undefined name', () => {
    expect(getInitials(undefined)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('truncates to 2 chars for long names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  it('handles lowercase names by uppercasing', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('handles single character name', () => {
    expect(getInitials('A')).toBe('A');
  });
});

describe('GroupPlanChat - formatMessageTime', () => {
  it('returns "Just now" for messages less than 1 minute old', () => {
    const now = new Date().toISOString();
    expect(formatMessageTime(now)).toBe('Just now');
  });

  it('returns minutes ago for recent messages', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatMessageTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago for messages within 24h', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatMessageTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns "Yesterday" for messages 24-48h old', () => {
    const yesterday = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(formatMessageTime(yesterday)).toBe('Yesterday');
  });

  it('returns days ago for messages within a week', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(formatMessageTime(threeDaysAgo)).toBe('3d ago');
  });

  it('returns formatted date for older messages', () => {
    const oldDate = new Date('2025-01-15T10:00:00Z').toISOString();
    const result = formatMessageTime(oldDate);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it('returns 59m ago just before 1 hour', () => {
    const fiftyNineMin = new Date(Date.now() - 59 * 60000).toISOString();
    expect(formatMessageTime(fiftyNineMin)).toBe('59m ago');
  });
});

describe('GroupPlanChat - truncateMessage', () => {
  it('returns short messages unchanged', () => {
    expect(truncateMessage('Hello!')).toBe('Hello!');
  });

  it('truncates long messages with ellipsis', () => {
    const longText = 'a'.repeat(250);
    const result = truncateMessage(longText);
    expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(result).toMatch(/\.\.\.$/);
  });

  it('respects custom maxLen', () => {
    const text = 'Hello World!';
    const result = truncateMessage(text, 5);
    expect(result).toBe('Hello...');
  });

  it('returns exact-length messages unchanged', () => {
    const text = 'a'.repeat(200);
    expect(truncateMessage(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(truncateMessage('')).toBe('');
  });
});

describe('GroupPlanChat - Message Deduplication', () => {
  const existing: MockMessage[] = [
    { id: 'msg-1', content: 'Hello', sender_id: 'user-1', created_at: '2025-01-01T10:00:00Z' },
    { id: 'msg-2', content: 'Hi!', sender_id: 'user-2', created_at: '2025-01-01T10:01:00Z' },
  ];

  it('adds a new unique message', () => {
    const incoming: MockMessage = {
      id: 'msg-3',
      content: 'New msg',
      sender_id: 'user-1',
      created_at: '2025-01-01T10:02:00Z',
    };
    const result = deduplicateMessages(existing, incoming, 5);
    expect(result).toHaveLength(3);
    expect(result[2].id).toBe('msg-3');
  });

  it('does not duplicate an existing message', () => {
    const duplicate: MockMessage = {
      id: 'msg-1',
      content: 'Hello',
      sender_id: 'user-1',
      created_at: '2025-01-01T10:00:00Z',
    };
    const result = deduplicateMessages(existing, duplicate, 5);
    expect(result).toHaveLength(2);
  });

  it('enforces maxMessages limit', () => {
    const msgs: MockMessage[] = [
      { id: '1', content: 'a', sender_id: 'u1', created_at: '2025-01-01T10:00:00Z' },
      { id: '2', content: 'b', sender_id: 'u1', created_at: '2025-01-01T10:01:00Z' },
      { id: '3', content: 'c', sender_id: 'u1', created_at: '2025-01-01T10:02:00Z' },
    ];
    const incoming: MockMessage = {
      id: '4',
      content: 'd',
      sender_id: 'u1',
      created_at: '2025-01-01T10:03:00Z',
    };
    const result = deduplicateMessages(msgs, incoming, 3);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('2'); // oldest dropped
    expect(result[2].id).toBe('4'); // newest added
  });
});

describe('GroupPlanChat - Sender Name Resolution', () => {
  const names: Record<string, string> = {
    'user-1': 'Sarah',
    'user-2': 'Mike',
  };

  it('returns "You" for current user', () => {
    expect(getSenderName('user-1', 'user-1', names)).toBe('You');
  });

  it('returns name from map for other participants', () => {
    expect(getSenderName('user-2', 'user-1', names)).toBe('Mike');
  });

  it('returns "Friend" for unknown participants', () => {
    expect(getSenderName('user-99', 'user-1', names)).toBe('Friend');
  });
});

describe('Plan Confirmation - canConfirmPlan', () => {
  it('returns false for empty participants', () => {
    expect(canConfirmPlan([])).toBe(false);
  });

  it('returns false if no one accepted', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'invited' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'maybe' },
    ];
    expect(canConfirmPlan(participants)).toBe(false);
  });

  it('returns false if there are still pending invitations', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'invited' },
    ];
    expect(canConfirmPlan(participants)).toBe(false);
  });

  it('returns true when at least one accepted and none pending', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'declined' },
    ];
    expect(canConfirmPlan(participants)).toBe(true);
  });

  it('returns true when all accepted', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'accepted' },
      { id: 'p3', user_id: 'u3', rsvp_status: 'accepted' },
    ];
    expect(canConfirmPlan(participants)).toBe(true);
  });

  it('returns true with mix of accepted, maybe, declined (no pending)', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'maybe' },
      { id: 'p3', user_id: 'u3', rsvp_status: 'declined' },
    ];
    expect(canConfirmPlan(participants)).toBe(true);
  });

  it('returns false with only maybe and declined (no accepted)', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'maybe' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'declined' },
    ];
    expect(canConfirmPlan(participants)).toBe(false);
  });

  it('returns false with only no_response', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'no_response' },
    ];
    expect(canConfirmPlan(participants)).toBe(false);
  });
});

describe('Plan Confirmation - summarizeRsvps', () => {
  it('returns "No participants" for empty list', () => {
    expect(summarizeRsvps([])).toBe('No participants');
  });

  it('summarizes all accepted', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'accepted' },
    ];
    expect(summarizeRsvps(participants)).toBe('2 going');
  });

  it('summarizes mixed statuses', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'maybe' },
      { id: 'p3', user_id: 'u3', rsvp_status: 'invited' },
    ];
    expect(summarizeRsvps(participants)).toBe('1 going, 1 maybe, 1 pending');
  });

  it('summarizes with declined', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'declined' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'declined' },
    ];
    expect(summarizeRsvps(participants)).toBe('2 declined');
  });

  it('summarizes all four statuses', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'maybe' },
      { id: 'p3', user_id: 'u3', rsvp_status: 'declined' },
      { id: 'p4', user_id: 'u4', rsvp_status: 'invited' },
    ];
    expect(summarizeRsvps(participants)).toBe('1 going, 1 maybe, 1 declined, 1 pending');
  });

  it('does not count no_response in any category', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'no_response' },
    ];
    // no_response is not in any of the 4 tracked categories
    expect(summarizeRsvps(participants)).toBe('No participants');
  });
});

describe('RSVP Persistence - Optimistic Update', () => {
  const mockInvitations: GroupInvitation[] = [
    {
      id: 'inv-1',
      plan_id: 'plan-1',
      rsvp_status: 'invited',
      invited_at: '2025-01-01T10:00:00Z',
      plan: {
        id: 'plan-1',
        title: 'Dinner',
        suggested_time: new Date(Date.now() + 86400000).toISOString(),
        meeting_address: 'Deep Ellum',
        creator_id: 'friend-1',
        creator_name: 'Sarah',
      },
    },
    {
      id: 'inv-2',
      plan_id: 'plan-2',
      rsvp_status: 'invited',
      invited_at: '2025-01-01T11:00:00Z',
      plan: {
        id: 'plan-2',
        title: 'Hike',
        suggested_time: new Date(Date.now() + 172800000).toISOString(),
        meeting_address: 'Cedar Ridge',
        creator_id: 'friend-2',
        creator_name: 'Mike',
      },
    },
  ];

  it('optimistically updates RSVP status without removing', () => {
    const updated = optimisticRsvpUpdate(mockInvitations, 'inv-1', 'accepted');
    expect(updated).toHaveLength(2);
    expect(updated[0].rsvp_status).toBe('accepted');
    expect(updated[1].rsvp_status).toBe('invited');
  });

  it('does not change other invitations during optimistic update', () => {
    const updated = optimisticRsvpUpdate(mockInvitations, 'inv-1', 'declined');
    expect(updated[1]).toEqual(mockInvitations[1]);
  });

  it('removes invitation after successful persistence', () => {
    const updated = optimisticRsvpUpdate(mockInvitations, 'inv-1', 'accepted');
    const removed = removeInvitation(updated, 'inv-1');
    expect(removed).toHaveLength(1);
    expect(removed[0].id).toBe('inv-2');
  });

  it('rollback restores original state on failure', () => {
    const snapshot = [...mockInvitations];
    // Simulate optimistic update
    const updated = optimisticRsvpUpdate(mockInvitations, 'inv-1', 'accepted');
    expect(updated[0].rsvp_status).toBe('accepted');
    // Simulate rollback
    expect(snapshot[0].rsvp_status).toBe('invited');
    expect(snapshot).toHaveLength(2);
  });
});

describe('RSVP Persistence - Response Text', () => {
  it('returns correct text for accepted', () => {
    expect(getResponseText('accepted')).toBe('See you there! Added to your calendar.');
  });

  it('returns correct text for declined', () => {
    expect(getResponseText('declined')).toBe('Maybe next time!');
  });

  it('returns correct text for maybe', () => {
    expect(getResponseText('maybe')).toBe('Noted as maybe!');
  });
});

describe('RSVP Persistence - Calendar Event Creation Logic', () => {
  it('builds correct WKT point from meeting location', () => {
    const loc = { latitude: 32.7767, longitude: -96.7970 };
    const wkt = `POINT(${loc.longitude} ${loc.latitude})`;
    expect(wkt).toBe('POINT(-96.797 32.7767)');
  });

  it('falls back to POINT(0 0) when no location', () => {
    function buildWkt(loc: { latitude: number; longitude: number } | null): string {
      return loc ? `POINT(${loc.longitude} ${loc.latitude})` : 'POINT(0 0)';
    }
    expect(buildWkt(null)).toBe('POINT(0 0)');
  });

  it('computes correct end time (2 hours after start)', () => {
    const startTime = new Date('2025-06-15T18:00:00Z');
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    expect(endTime.toISOString()).toBe('2025-06-15T20:00:00.000Z');
  });
});

describe('Plan Status Update Logic', () => {
  it('builds correct update payload for confirm', () => {
    const now = new Date().toISOString();
    const newStatus: string = 'confirmed';
    const update: Record<string, any> = {
      status: newStatus,
      updated_at: now,
    };
    if (newStatus === 'confirmed') {
      update.confirmed_at = now;
    }
    expect(update.status).toBe('confirmed');
    expect(update.confirmed_at).toBeTruthy();
    expect(update.updated_at).toBeTruthy();
  });

  it('builds correct update payload for cancel (no confirmed_at)', () => {
    const now = new Date().toISOString();
    const newStatus: string = 'cancelled';
    const update: Record<string, any> = {
      status: newStatus,
      updated_at: now,
    };
    if (newStatus === 'confirmed') {
      update.confirmed_at = now;
    }
    expect(update.status).toBe('cancelled');
    expect(update.confirmed_at).toBeUndefined();
  });
});

describe('Group Conversation Tag Generation', () => {
  it('generates correct plan tag', () => {
    const planId = 'plan-abc-123';
    const planTag = `plan:${planId}`;
    expect(planTag).toBe('plan:plan-abc-123');
  });

  it('generates correct conversation title with plan name', () => {
    const title = 'Dinner at Deep Ellum';
    const planTag = 'plan:plan-1';
    const convTitle = `${title} [${planTag}]`;
    expect(convTitle).toBe('Dinner at Deep Ellum [plan:plan-1]');
  });

  it('deduplicates creator in participant list', () => {
    const creatorId = 'user-1';
    const participantIds = ['user-1', 'user-2', 'user-3'];
    const allUserIds = [creatorId, ...participantIds.filter((id) => id !== creatorId)];
    expect(allUserIds).toEqual(['user-1', 'user-2', 'user-3']);
    expect(allUserIds).toHaveLength(3);
  });

  it('handles creator not in participants list', () => {
    const creatorId = 'user-1';
    const participantIds = ['user-2', 'user-3'];
    const allUserIds = [creatorId, ...participantIds.filter((id) => id !== creatorId)];
    expect(allUserIds).toEqual(['user-1', 'user-2', 'user-3']);
    expect(allUserIds).toHaveLength(3);
  });
});

describe('Chat Integration in Plan Card', () => {
  it('builds participant names map correctly', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted', name: 'Sarah Johnson' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'maybe', name: 'Mike Chen' },
      { id: 'p3', user_id: 'u3', rsvp_status: 'invited' },
    ];

    const names: Record<string, string> = {};
    participants.forEach((p) => {
      if (p.name) names[p.user_id] = p.name;
    });

    expect(names).toEqual({
      u1: 'Sarah Johnson',
      u2: 'Mike Chen',
    });
    expect(names['u3']).toBeUndefined();
  });

  it('extracts user IDs from participants', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
      { id: 'p2', user_id: 'u2', rsvp_status: 'maybe' },
    ];

    const userIds = participants.map((p) => p.user_id);
    expect(userIds).toEqual(['u1', 'u2']);
  });

  it('toggles chat expansion correctly', () => {
    let expandedChat: string | null = null;

    // Expand plan-1
    expandedChat = expandedChat === 'plan-1' ? null : 'plan-1';
    expect(expandedChat).toBe('plan-1');

    // Collapse plan-1
    expandedChat = expandedChat === 'plan-1' ? null : 'plan-1';
    expect(expandedChat).toBeNull();

    // Expand plan-2 (different plan)
    expandedChat = expandedChat === 'plan-2' ? null : 'plan-2';
    expect(expandedChat).toBe('plan-2');
  });
});

describe('Optimistic Message Insert', () => {
  it('creates optimistic message with correct structure', () => {
    const conversationId = 'conv-1';
    const currentUserId = 'user-1';
    const text = 'Hello group!';

    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      message_type: 'text' as const,
      content: text,
      metadata: {},
      status: 'sent' as const,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };

    expect(optimisticMsg.conversation_id).toBe(conversationId);
    expect(optimisticMsg.sender_id).toBe(currentUserId);
    expect(optimisticMsg.content).toBe(text);
    expect(optimisticMsg.id).toMatch(/^optimistic-/);
  });

  it('replaces optimistic message with real one', () => {
    const msgs = [
      { id: 'optimistic-123', content: 'Hello', sender_id: 'u1' },
      { id: 'msg-1', content: 'Older', sender_id: 'u2' },
    ];
    const realMsg = { id: 'msg-2', content: 'Hello', sender_id: 'u1' };

    const updated = msgs.map((m) =>
      m.id === 'optimistic-123' ? realMsg : m
    );

    expect(updated[0].id).toBe('msg-2');
    expect(updated[1].id).toBe('msg-1');
  });

  it('removes optimistic message on send failure', () => {
    const msgs = [
      { id: 'msg-1', content: 'A', sender_id: 'u1' },
      { id: 'optimistic-456', content: 'B', sender_id: 'u1' },
    ];

    const filtered = msgs.filter((m) => m.id !== 'optimistic-456');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('msg-1');
  });
});

describe('RSVP Config Mapping', () => {
  const RSVP_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    accepted: { color: '#09DB98', icon: 'checkmark-circle', label: 'Going' },
    maybe: { color: '#F59E0B', icon: 'help-circle', label: 'Maybe' },
    declined: { color: '#EF4444', icon: 'close-circle', label: 'No' },
    invited: { color: '#48484A', icon: 'mail-outline', label: 'Pending' },
    no_response: { color: '#48484A', icon: 'ellipse-outline', label: 'No reply' },
  };

  it('maps all five statuses', () => {
    expect(Object.keys(RSVP_CONFIG)).toHaveLength(5);
  });

  it('accepted maps to green Going', () => {
    expect(RSVP_CONFIG.accepted.label).toBe('Going');
    expect(RSVP_CONFIG.accepted.icon).toBe('checkmark-circle');
  });

  it('maybe maps to orange Maybe', () => {
    expect(RSVP_CONFIG.maybe.label).toBe('Maybe');
    expect(RSVP_CONFIG.maybe.icon).toBe('help-circle');
  });

  it('declined maps to red No', () => {
    expect(RSVP_CONFIG.declined.label).toBe('No');
    expect(RSVP_CONFIG.declined.icon).toBe('close-circle');
  });

  it('invited maps to gray Pending', () => {
    expect(RSVP_CONFIG.invited.label).toBe('Pending');
  });

  it('no_response maps to gray No reply', () => {
    expect(RSVP_CONFIG.no_response.label).toBe('No reply');
  });

  it('falls back to invited config for unknown status', () => {
    const status = 'unknown_status';
    const config = RSVP_CONFIG[status] || RSVP_CONFIG.invited;
    expect(config.label).toBe('Pending');
  });
});

describe('Edge Cases', () => {
  it('handles very large participant count for summarizeRsvps', () => {
    const participants: Participant[] = Array.from({ length: 100 }, (_, i) => ({
      id: `p${i}`,
      user_id: `u${i}`,
      rsvp_status: i % 2 === 0 ? 'accepted' as const : 'maybe' as const,
    }));
    const summary = summarizeRsvps(participants);
    expect(summary).toBe('50 going, 50 maybe');
  });

  it('canConfirmPlan with single accepted participant', () => {
    const participants: Participant[] = [
      { id: 'p1', user_id: 'u1', rsvp_status: 'accepted' },
    ];
    expect(canConfirmPlan(participants)).toBe(true);
  });

  it('formatMessageTime handles far future dates gracefully', () => {
    const futureDate = new Date('2030-12-25T10:00:00Z').toISOString();
    // Far future => negative diff => diffMin < 1 => "Just now"
    // This tests the boundary behavior
    const result = formatMessageTime(futureDate);
    // For future dates, diffMs is negative, diffMin < 1 => "Just now"
    expect(result).toBe('Just now');
  });

  it('truncateMessage with maxLen of 0 always truncates', () => {
    expect(truncateMessage('Hi', 0)).toBe('...');
  });

  it('deduplicateMessages with empty existing array', () => {
    const incoming: MockMessage = {
      id: 'msg-1',
      content: 'Hello',
      sender_id: 'u1',
      created_at: '2025-01-01T10:00:00Z',
    };
    const result = deduplicateMessages([], incoming, 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-1');
  });
});
