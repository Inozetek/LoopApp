/**
 * Comments Polish Tests
 *
 * Pure-logic tests for the comment enhancements:
 * - Star fill state logic
 * - Helpful state management (prevent double-tap)
 * - Avatar display logic (URL vs initial letter)
 */

describe('Comments Polish', () => {
  // --- Star fill logic ---
  describe('getStarFillState', () => {
    // Mirrors the inline logic: star <= (rating ?? 0)
    function getStarFillState(rating: number | null, starIndex: number): 'filled' | 'empty' {
      return starIndex <= (rating ?? 0) ? 'filled' : 'empty';
    }

    it('returns empty for all stars when rating is null', () => {
      for (let i = 1; i <= 5; i++) {
        expect(getStarFillState(null, i)).toBe('empty');
      }
    });

    it('returns empty for all stars when rating is 0', () => {
      for (let i = 1; i <= 5; i++) {
        expect(getStarFillState(0, i)).toBe('empty');
      }
    });

    it('fills correct number for rating 3', () => {
      expect(getStarFillState(3, 1)).toBe('filled');
      expect(getStarFillState(3, 2)).toBe('filled');
      expect(getStarFillState(3, 3)).toBe('filled');
      expect(getStarFillState(3, 4)).toBe('empty');
      expect(getStarFillState(3, 5)).toBe('empty');
    });

    it('fills all for rating 5', () => {
      for (let i = 1; i <= 5; i++) {
        expect(getStarFillState(5, i)).toBe('filled');
      }
    });

    it('fills only first for rating 1', () => {
      expect(getStarFillState(1, 1)).toBe('filled');
      expect(getStarFillState(1, 2)).toBe('empty');
    });
  });

  // --- Helpful state management ---
  describe('helpedComments Set logic', () => {
    it('starts empty', () => {
      const helped = new Set<string>();
      expect(helped.size).toBe(0);
    });

    it('records a comment as helped', () => {
      const helped = new Set<string>();
      const newHelped = new Set(helped).add('comment-1');
      expect(newHelped.has('comment-1')).toBe(true);
    });

    it('prevents double-tap (has returns true after mark)', () => {
      const helped = new Set<string>();
      const afterFirst = new Set(helped).add('comment-1');
      // Second tap should be blocked by .has() check
      expect(afterFirst.has('comment-1')).toBe(true);
    });

    it('tracks multiple comments independently', () => {
      let helped = new Set<string>();
      helped = new Set(helped).add('c1');
      helped = new Set(helped).add('c2');
      expect(helped.has('c1')).toBe(true);
      expect(helped.has('c2')).toBe(true);
      expect(helped.has('c3')).toBe(false);
    });
  });

  // --- Avatar display logic ---
  describe('avatar display logic', () => {
    function getAvatarDisplay(userAvatar?: string | null, userName?: string): { type: 'image'; uri: string } | { type: 'initial'; letter: string } {
      if (userAvatar) {
        return { type: 'image', uri: userAvatar };
      }
      return { type: 'initial', letter: (userName || 'L')[0].toUpperCase() };
    }

    it('returns image type when avatar URL exists', () => {
      const result = getAvatarDisplay('https://example.com/avatar.jpg', 'Alice');
      expect(result.type).toBe('image');
      expect((result as any).uri).toBe('https://example.com/avatar.jpg');
    });

    it('returns initial letter when no avatar URL', () => {
      const result = getAvatarDisplay(null, 'Bob');
      expect(result.type).toBe('initial');
      expect((result as any).letter).toBe('B');
    });

    it('uppercases the initial letter', () => {
      const result = getAvatarDisplay(undefined, 'charlie');
      expect((result as any).letter).toBe('C');
    });

    it('falls back to L when no name provided', () => {
      const result = getAvatarDisplay(null, undefined);
      expect((result as any).letter).toBe('L');
    });

    it('falls back to L for empty string name', () => {
      const result = getAvatarDisplay(null, '');
      expect((result as any).letter).toBe('L');
    });
  });

  // --- Star rating toggle logic ---
  describe('star rating toggle', () => {
    function toggleRating(current: number | null, tapped: number): number | null {
      return current === tapped ? null : tapped;
    }

    it('sets rating when tapping a star from null', () => {
      expect(toggleRating(null, 3)).toBe(3);
    });

    it('clears rating when tapping same star', () => {
      expect(toggleRating(3, 3)).toBe(null);
    });

    it('changes rating when tapping different star', () => {
      expect(toggleRating(3, 5)).toBe(5);
    });
  });
});
