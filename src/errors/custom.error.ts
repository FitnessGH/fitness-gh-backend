export class CustomError extends Error {
  status?: number;
  success?: boolean;
  data?: any;
  details?: any;
  stack?: string | undefined;
  constructor({
    message,
    status = 500,
    success = false,
    data = null,
    details = null,
    stack,
  }: {
    message: string;
    status?: number;
    success?: boolean;
    data?: any;
    details?: any;
    stack?: string | undefined;
  }) {
    super(message);
    this.message = message;
    this.status = status;
    this.success = success;
    this.data = data;
    this.details = details;
    this.stack = stack;
  }
}

export type ResponseError = {
  message: string;
  status: number;
  success?: boolean;
  data?: any;
  details?: any;
  stack?: string | undefined;
};
