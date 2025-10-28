import type MessageResponse from "@/types/message-response.type";

type ErrorResponse = {
  stack?: string;
} & MessageResponse;
export default ErrorResponse;
