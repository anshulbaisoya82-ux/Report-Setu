import { ApiMeta } from './apiResponse';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Parses, sanitizes, and clamps page and limit query parameters.
 */
export const parsePagination = (
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 10,
  maxLimit = 100
): PaginationParams => {
  let page = parseInt(String(query.page || '1'), 10);
  let limit = parseInt(String(query.limit || defaultLimit), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Builds standard pagination metadata object
 */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
): ApiMeta => {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
