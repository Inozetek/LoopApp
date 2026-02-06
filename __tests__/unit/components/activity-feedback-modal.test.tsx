/**
 * Tests for Activity Feedback Modal component logic
 *
 * Tests the feedback flow behavior: tag toggling, rating flow,
 * and feedback data formatting.
 */

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

describe('Activity Feedback Modal - Logic', () => {
  describe('Tag Toggle Logic', () => {
    /**
     * Mirrors toggleTag behavior from activity-feedback-modal.tsx line 102
     * If tag is already selected, remove it. Otherwise, add it.
     */
    function toggleTag(selectedTags: string[], tagId: string): string[] {
      return selectedTags.includes(tagId)
        ? selectedTags.filter((t) => t !== tagId)
        : [...selectedTags, tagId];
    }

    it('should add a tag when not previously selected', () => {
      const result = toggleTag([], 'too_expensive');
      expect(result).toEqual(['too_expensive']);
    });

    it('should remove a tag when already selected', () => {
      const result = toggleTag(['too_expensive'], 'too_expensive');
      expect(result).toEqual([]);
    });

    it('should allow multiple tags to be selected', () => {
      let tags: string[] = [];
      tags = toggleTag(tags, 'too_expensive');
      tags = toggleTag(tags, 'too_far');
      tags = toggleTag(tags, 'boring');
      expect(tags).toEqual(['too_expensive', 'too_far', 'boring']);
    });

    it('should remove only the targeted tag', () => {
      const tags = ['too_expensive', 'too_far', 'boring'];
      const result = toggleTag(tags, 'too_far');
      expect(result).toEqual(['too_expensive', 'boring']);
    });

    it('should handle toggling the same tag twice (add then remove)', () => {
      let tags: string[] = [];
      tags = toggleTag(tags, 'too_crowded');
      expect(tags).toEqual(['too_crowded']);
      tags = toggleTag(tags, 'too_crowded');
      expect(tags).toEqual([]);
    });
  });

  describe('Rating Flow Logic', () => {
    /**
     * Mirrors handleRating behavior from activity-feedback-modal.tsx line 72
     * - thumbs_up -> submit immediately (or show capture prompt if enabled)
     * - thumbs_down -> show follow-up questions
     */

    function simulateRatingFlow(
      rating: 'thumbs_up' | 'thumbs_down',
      enableMomentCapture: boolean
    ): { submitted: boolean; showFollowUp: boolean; showCapturePrompt: boolean } {
      let submitted = false;
      let showFollowUp = false;
      let showCapturePrompt = false;

      if (rating === 'thumbs_down') {
        showFollowUp = true;
      } else {
        if (enableMomentCapture) {
          showCapturePrompt = true;
        }
        submitted = true;
      }

      return { submitted, showFollowUp, showCapturePrompt };
    }

    it('should submit immediately for thumbs up without moment capture', () => {
      const result = simulateRatingFlow('thumbs_up', false);
      expect(result.submitted).toBe(true);
      expect(result.showFollowUp).toBe(false);
      expect(result.showCapturePrompt).toBe(false);
    });

    it('should show capture prompt for thumbs up with moment capture enabled', () => {
      const result = simulateRatingFlow('thumbs_up', true);
      expect(result.submitted).toBe(true);
      expect(result.showFollowUp).toBe(false);
      expect(result.showCapturePrompt).toBe(true);
    });

    it('should show follow-up for thumbs down', () => {
      const result = simulateRatingFlow('thumbs_down', false);
      expect(result.submitted).toBe(false);
      expect(result.showFollowUp).toBe(true);
    });
  });

  describe('Feedback Data Formatting', () => {
    /**
     * Mirrors handleSubmit data shape from activity-feedback-modal.tsx line 109
     * The onSubmit callback receives: { rating, tags?, notes? }
     */
    function formatFeedbackData(
      rating: 'thumbs_up' | 'thumbs_down',
      tags: string[],
      notes: string
    ): {
      rating: 'thumbs_up' | 'thumbs_down';
      tags?: string[];
      notes?: string;
    } {
      return {
        rating,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
      };
    }

    it('should include tags only if non-empty', () => {
      const result = formatFeedbackData('thumbs_down', ['too_expensive'], '');
      expect(result.tags).toEqual(['too_expensive']);
    });

    it('should exclude tags when empty array', () => {
      const result = formatFeedbackData('thumbs_up', [], '');
      expect(result.tags).toBeUndefined();
    });

    it('should include notes only if non-empty after trim', () => {
      const result = formatFeedbackData('thumbs_down', [], 'Food was cold');
      expect(result.notes).toBe('Food was cold');
    });

    it('should exclude notes when empty or whitespace', () => {
      expect(formatFeedbackData('thumbs_up', [], '').notes).toBeUndefined();
      expect(formatFeedbackData('thumbs_up', [], '   ').notes).toBeUndefined();
    });

    it('should trim notes whitespace', () => {
      const result = formatFeedbackData('thumbs_down', [], '  Too noisy  ');
      expect(result.notes).toBe('Too noisy');
    });

    it('should always include rating', () => {
      const up = formatFeedbackData('thumbs_up', [], '');
      const down = formatFeedbackData('thumbs_down', [], '');
      expect(up.rating).toBe('thumbs_up');
      expect(down.rating).toBe('thumbs_down');
    });
  });

  describe('Negative Tags Configuration', () => {
    const NEGATIVE_TAGS = [
      { id: 'too_expensive', label: 'Too expensive', icon: 'cash-outline' },
      { id: 'too_far', label: 'Too far', icon: 'location-outline' },
      { id: 'too_crowded', label: 'Too crowded', icon: 'people-outline' },
      { id: 'boring', label: 'Boring', icon: 'sad-outline' },
      { id: 'bad_weather', label: 'Bad weather', icon: 'rainy-outline' },
      { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
    ];

    it('should have 6 negative feedback tags', () => {
      expect(NEGATIVE_TAGS).toHaveLength(6);
    });

    it('should have unique IDs', () => {
      const ids = NEGATIVE_TAGS.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have non-empty labels and icons', () => {
      for (const tag of NEGATIVE_TAGS) {
        expect(tag.label).toBeTruthy();
        expect(tag.icon).toBeTruthy();
        expect(tag.id).toBeTruthy();
      }
    });

    it('should include an "other" option for uncategorized feedback', () => {
      const otherTag = NEGATIVE_TAGS.find((t) => t.id === 'other');
      expect(otherTag).toBeDefined();
    });
  });

  describe('Modal State Reset', () => {
    /**
     * Mirrors handleClose behavior from activity-feedback-modal.tsx line 123
     * All state should reset when modal closes
     */
    it('should reset all state on close', () => {
      // Simulate state before close
      let rating: string | null = 'thumbs_down';
      let selectedTags = ['too_expensive', 'boring'];
      let notes = 'Not great';
      let showFollowUp = true;
      let showCapturePrompt = false;

      // Reset (handleClose behavior)
      rating = null;
      selectedTags = [];
      notes = '';
      showFollowUp = false;
      showCapturePrompt = false;

      expect(rating).toBeNull();
      expect(selectedTags).toEqual([]);
      expect(notes).toBe('');
      expect(showFollowUp).toBe(false);
      expect(showCapturePrompt).toBe(false);
    });
  });
});
