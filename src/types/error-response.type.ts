import type MessageResponse from "./message-response.type.js";

type ErrorResponse = {
  stack?: string;
} & MessageResponse;
export default ErrorResponse;
