import { CustomError } from "./custom.error.js";

/**
 * The BadRequestError class is a custom error class for invalid client requests.
 */
export class BadRequestError extends CustomError {
  /**
   * Constructor for the class.
   *
   * @param {object} options - The options for the error.
   * @param {string} options.message - The error message.
   * @param {number} [options.status] - The HTTP status code.
   * @param {boolean} [options.success] - The success status.
   * @param {any} [options.data] - The data to be sent.
   * @param {any} [options.details] - Additional error details.
   */
  constructor({
    message,
    status = 400,
    success = false,
    data = null,
    details = null,
  }: {
    message: string;
    status?: number;
    success?: boolean;
    data?: any;
    details?: any;
  }) {
    super({ message, status, success, data, details });
    this.message = message;
    this.status = status;
    this.success = success;
    this.data = data;
    this.details = details;
  }
}

