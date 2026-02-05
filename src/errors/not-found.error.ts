import { CustomError } from "./custom.error.js";

export class NotFoundError extends CustomError {
  constructor({
    message,
    status = 404,
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
