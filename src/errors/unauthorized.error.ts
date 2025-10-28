import { CustomError } from "@/errors/custom.error";

export class UnauthorizedError extends CustomError {
  constructor({
    message,
        status = 401,
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
