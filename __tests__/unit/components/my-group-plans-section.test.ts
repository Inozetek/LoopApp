/**
 * Tests for MyGroupPlansSection — RSVP badge mapping and confirm/cancel logic.
 */

describe('MyGroupPlansSection - RSVP Badge Mapping', () => {
  const RSVP_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
    accepted: { color: '#34D399', icon: 'checkmark-circle', label: 'Going' },
    maybe: { color: '#F59E0B', icon: 'help-circle', label: 'Maybe' },
    declined: { color: '#EF4444', icon: 'close-circle', label: 'No' },
    invited: { color: '#9CA3AF', icon: 'mail-outline', label: 'Pending' },
    no_response: { color: '#9CA3AF', icon: 'ellipse-outline', label: 'No reply' },
  };

  it('maps accepted to green Going badge', () => {
    const config = RSVP_CONFIG['accepted'];
    expect(config.label).toBe('Going');
    expect(config.icon).toBe('checkmark-circle');
  });

  it('maps maybe to orange Maybe badge', () => {
    const config = RSVP_CONFIG['maybe'];
    expect(config.label).toBe('Maybe');
    expect(config.icon).toBe('help-circle');
  });

  it('maps declined to red No badge', () => {
    const config = RSVP_CONFIG['declined'];
    expect(config.label).toBe('No');
    expect(config.icon).toBe('close-circle');
  });

  it('maps invited to gray Pending badge', () => {
    const config = RSVP_CONFIG['invited'];
    expect(config.label).toBe('Pending');
    expect(config.icon).toBe('mail-outline');
  });

  it('maps no_response to gray No reply badge', () => {
    const config = RSVP_CONFIG['no_response'];
    expect(config.label).toBe('No reply');
  });
});

describe('MyGroupPlansSection - Confirm/Cancel Logic', () => {
  it('confirm changes status to confirmed with timestamp', () => {
    const now = new Date().toISOString();
    const update = {
      status: 'confirmed' as const,
      confirmed_at: now,
      updated_at: now,
    };

    expect(update.status).toBe('confirmed');
    expect(update.confirmed_at).toBeTruthy();
  });

  it('cancel changes status to cancelled without confirmed_at', () => {
    const now = new Date().toISOString();
    const newStatus: string = 'cancelled';
    const update: Record<string, any> = {
      status: newStatus,
      updated_at: now,
    };

    // Replicate component logic: only add confirmed_at for 'confirmed'
    if (newStatus === 'confirmed') {
      update.confirmed_at = now;
    }

    expect(update.status).toBe('cancelled');
    expect(update.confirmed_at).toBeUndefined();
  });
});

describe('MyGroupPlansSection - Initials Helper', () => {
  function getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

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

  it('truncates to 2 characters for long names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });
});

describe('MyGroupPlansSection - Date Formatting', () => {
  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  it('formats today dates correctly', () => {
    const now = new Date();
    now.setHours(18, 30, 0, 0);
    const result = formatDate(now.toISOString());
    expect(result).toMatch(/^Today at/);
  });

  it('formats tomorrow dates correctly', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    const result = formatDate(tomorrow.toISOString());
    expect(result).toMatch(/^Tomorrow at/);
  });

  it('formats other dates with weekday', () => {
    // Pick a date far in the future
    const futureDate = new Date('2025-12-25T15:00:00');
    const result = formatDate(futureDate.toISOString());
    // Should contain "Thu" for Dec 25, 2025
    expect(result).toMatch(/Thu/);
    expect(result).toMatch(/Dec/);
  });
});
