import type { Request } from "express";
// import type { JwtPayload } from "jsonwebtoken";

// The CustomRequest interface enables us to provide JWTs to our controllers.
export type CustomRequest = {
//   token: JwtPayload;
} & Request;
