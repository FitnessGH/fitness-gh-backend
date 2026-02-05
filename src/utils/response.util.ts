import type { ApiErrorResponse, ApiMeta, ApiSuccessResponse } from "../types/api-response.type.js";

/**
 * Creates a standardized success response
 * @template T - The type of data being returned
 * @param data - The data to include in the response
 * @param meta - Optional metadata (pagination, timestamps, etc.)
 * @returns Standardized success response object
 */
export function success<T>(data: T, meta: ApiMeta = {}): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

/**
 * Creates a standardized error response
 * Matches the structure from CustomError and ResponseError in @/errors
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 * @param data - Optional data to include
 * @returns Standardized error response object
 */
export function error(
  message: string,
  status: number,
  details?: any,
  data?: any,
): ApiErrorResponse {
  return {
    success: false,
    message,
    status,
    details,
    data,
  };
}
