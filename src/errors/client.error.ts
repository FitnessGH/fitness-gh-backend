import { CustomError } from "@/errors/custom.error";

export class ClientError extends CustomError {
  /**
   * Constructor for the ClientError class.
   *
   * @param {object} options - The options for the error.
   * @param {string} options.message - The error message.
   * @param {number} [options.status] - The HTTP status code.
   * @param {boolean} [options.success] - The success status.
   * @param {any} [options.data] - The data to be sent.
   * @param {any} [options.details] - The details of the error.
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
