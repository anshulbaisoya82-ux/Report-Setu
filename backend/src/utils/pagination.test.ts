import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginationMeta } from './pagination';

describe('Pagination Utility (Task 1.5)', () => {
  it('should parse valid page and limit query parameters', () => {
    const params = parsePagination({ page: '2', limit: '25' });
    expect(params.page).toBe(2);
    expect(params.limit).toBe(25);
    expect(params.skip).toBe(25);
  });

  it('should apply defaults for missing or invalid parameters', () => {
    const params = parsePagination({});
    expect(params.page).toBe(1);
    expect(params.limit).toBe(10);
    expect(params.skip).toBe(0);

    const invalidParams = parsePagination({ page: '-5', limit: 'abc' });
    expect(invalidParams.page).toBe(1);
    expect(invalidParams.limit).toBe(10);
  });

  it('should clamp limit to maxLimit', () => {
    const params = parsePagination({ page: '1', limit: '500' }, 10, 50);
    expect(params.limit).toBe(50);
  });

  it('should calculate pagination metadata accurately', () => {
    const meta = buildPaginationMeta(45, 2, 10);
    expect(meta.total).toBe(45);
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(10);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(true);
  });

  it('should handle edge cases like 0 total items', () => {
    const meta = buildPaginationMeta(0, 1, 10);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPrevPage).toBe(false);
  });
});
