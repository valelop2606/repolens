// Feature: codebase-understanding-platform, Property 16
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateProgress } from '../utils/calculateProgress';

/**
 * **Validates: Requirements 9.4**
 *
 * Property 16: Progress percentage accuracy
 * For any set of N completed stages out of a total of 8 stages (where 0 ≤ N ≤ 8),
 * the Learning Journey progress indicator SHALL display exactly
 * Math.round((N / 8) * 100) percent.
 */
describe('Learning Journey Progress Calculation', () => {
  it('should return Math.round((N / 8) * 100) for any N between 0 and 8', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        (completedStages: number) => {
          const totalStages = 8;
          const result = calculateProgress(completedStages, totalStages);
          const expected = Math.round((completedStages / totalStages) * 100);
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always return a value between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        (completedStages: number) => {
          const totalStages = 8;
          const result = calculateProgress(completedStages, totalStages);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 0 when no stages are completed', () => {
    expect(calculateProgress(0, 8)).toBe(0);
  });

  it('should return 100 when all stages are completed', () => {
    expect(calculateProgress(8, 8)).toBe(100);
  });

  it('should handle total of 0 without error', () => {
    expect(calculateProgress(0, 0)).toBe(0);
  });
});
