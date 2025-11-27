/**
 * API Response Types
 * Standardized response structure for all API endpoints
 * Aligned with existing error structure in @/errors
 */

/**
 * Metadata object for API responses
 * Can include pagination info, timestamps, etc.
 */
export interface ApiMeta {
  [key: string]: any;
}

/**
 * Standardized success response structure
 * @template T - The type of data being returned
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta: ApiMeta;
}

/**
 * Standardized error response structure
 * Matches the structure from CustomError and ResponseError in @/errors
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  status: number;
  data?: any;
  details?: any;
  stack?: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
