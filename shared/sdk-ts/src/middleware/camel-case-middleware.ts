/**
 * Middleware to transform API response keys from snake_case to camelCase.
 * Automatically applied by createApiFetcher unless explicitly disabled.
 */
import type { ApiResponse, Middleware } from 'openapi-typescript-fetch';
import { transformKeysToCamelCase } from '../utils/case-transform';

/**
 * Creates a middleware that transforms all JSON response keys from snake_case to camelCase.
 * Non-JSON responses (PDF, CSV, XLSX) are passed through unchanged.
 */
export function createCamelCaseMiddleware(): Middleware {
  return async (url, init, next): Promise<ApiResponse> => {
    const response = await next(url, init);

    // Skip transformation for non-JSON content types (PDF, CSV, XLSX, etc.)
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return response;
    }

    // Transform response data keys from snake_case to camelCase
    return {
      ...response,
      data: transformKeysToCamelCase(response.data),
    };
  };
}
