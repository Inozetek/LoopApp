/**
 * Tests for Gemini API quota tracker
 *
 * Tests monthly reset logic, request counting, limit enforcement,
 * and graceful error handling.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

import {
  canMakeGeminiRequest,
  trackGeminiRequest,
  getGeminiUsageStats,
  resetGeminiUsageCounter,
} from '@/utils/gemini-quota-tracker';

describe('Gemini Quota Tracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canMakeGeminiRequest', () => {
    it('should allow request when counter is zero', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '0';
        return null;
      });

      const result = await canMakeGeminiRequest();
      expect(result).toBe(true);
    });

    it('should allow request when under limit', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '750';
        return null;
      });

      const result = await canMakeGeminiRequest();
      expect(result).toBe(true);
    });

    it('should deny request when at limit', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '1500';
        return null;
      });

      const result = await canMakeGeminiRequest();
      expect(result).toBe(false);
    });

    it('should deny request when over limit', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '2000';
        return null;
      });

      const result = await canMakeGeminiRequest();
      expect(result).toBe(false);
    });

    it('should reset counter and allow on new month', async () => {
      // Stored month is different from current
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return '2025-01'; // Old month
        if (key === 'gemini_request_count') return '1500'; // Was at limit
        return null;
      });

      const result = await canMakeGeminiRequest();
      expect(result).toBe(true);

      // Should have reset the counter
      expect(mockSetItem).toHaveBeenCalledWith('gemini_request_count', '0');
    });

    it('should reset counter when no stored month exists', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await canMakeGeminiRequest();
      expect(result).toBe(true);
      expect(mockSetItem).toHaveBeenCalledWith('gemini_request_count', '0');
    });

    it('should default to allowing on AsyncStorage error', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      const result = await canMakeGeminiRequest();
      expect(result).toBe(true);
    });
  });

  describe('trackGeminiRequest', () => {
    it('should increment counter by 1', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '5';
        return null;
      });

      await trackGeminiRequest();

      expect(mockSetItem).toHaveBeenCalledWith('gemini_request_count', '6');
    });

    it('should initialize to 1 on new month', async () => {
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return '2025-01'; // Old month
        if (key === 'gemini_request_count') return '999';
        return null;
      });

      await trackGeminiRequest();

      expect(mockSetItem).toHaveBeenCalledWith('gemini_request_count', '1');
    });

    it('should handle missing count gracefully (default to 0)', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return null;
        return null;
      });

      await trackGeminiRequest();

      expect(mockSetItem).toHaveBeenCalledWith('gemini_request_count', '1');
    });

    it('should not throw on AsyncStorage error', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(trackGeminiRequest()).resolves.toBeUndefined();
    });
  });

  describe('getGeminiUsageStats', () => {
    it('should return current stats', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '100';
        return null;
      });

      const stats = await getGeminiUsageStats();

      expect(stats.requestCount).toBe(100);
      expect(stats.monthlyLimit).toBe(1500);
      expect(stats.percentUsed).toBeCloseTo(6.67, 1);
      expect(stats.remainingRequests).toBe(1400);
      expect(stats.monthYear).toBe(currentMonth);
    });

    it('should return zero stats on error', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      const stats = await getGeminiUsageStats();

      expect(stats.requestCount).toBe(0);
      expect(stats.remainingRequests).toBe(1500);
      expect(stats.percentUsed).toBe(0);
    });

    it('should clamp remainingRequests to 0 when over limit', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'gemini_month_year') return currentMonth;
        if (key === 'gemini_request_count') return '2000';
        return null;
      });

      const stats = await getGeminiUsageStats();
      expect(stats.remainingRequests).toBe(0);
    });
  });

  describe('resetGeminiUsageCounter', () => {
    it('should reset count to 0 and set current month', async () => {
      await resetGeminiUsageCounter();

      expect(mockSetItem).toHaveBeenCalledWith('gemini_request_count', '0');
      expect(mockSetItem).toHaveBeenCalledWith(
        'gemini_month_year',
        expect.stringMatching(/^\d{4}-\d{2}$/)
      );
    });
  });

  describe('Month-Year Format', () => {
    it('should produce YYYY-MM format', () => {
      // Mirror the internal getCurrentMonthYear() logic
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      expect(monthYear).toMatch(/^\d{4}-\d{2}$/);
      expect(monthYear.length).toBe(7);
    });

    it('should pad single-digit months', () => {
      // January = month 0, formatted as "01"
      const padded = String(1).padStart(2, '0');
      expect(padded).toBe('01');
    });

    it('should not pad double-digit months', () => {
      const padded = String(12).padStart(2, '0');
      expect(padded).toBe('12');
    });
  });
});
