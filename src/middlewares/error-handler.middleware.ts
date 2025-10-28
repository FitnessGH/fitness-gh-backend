import type { NextFunction, Request, Response } from "express";

import type { ResponseError } from "@/errors";

import { CustomError } from "@/errors";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);
  if (
    !(err instanceof CustomError)
  // &&
  // !(err instanceof MulterError) &&
  // !(err instanceof Prisma.PrismaClientKnownRequestError)
  ) {
    res.status(500).json({
      status: 500,
      message: "Server error, please try again later",
    });
  }
  // else if (err instanceof MulterError) {
  //     if (err.code === "LIMIT_FILE_SIZE") {
  //         return res.status(400).json({
  //             status: 400,
  //             message: "File size should be 3MB or less",
  //             success: false,
  //             data: null,
  //         });
  //     }
  //
  //     if (err.code === "LIMIT_UNEXPECTED_FILE") {
  //         return res.status(400).json({
  //             status: 400,
  //             message: "File type is not supported",
  //             success: false,
  //             data: null,
  //         });
  //     }
  //
  //     if (err.code === "LIMIT_FILE_COUNT") {
  //         return res.status(400).json({
  //             status: 400,
  //             message: "You can't upload more than one file",
  //             success: false,
  //             data: null,
  //         });
  //     }
  // }
  // else if (err instanceof Prisma.PrismaClientKnownRequestError) {
  //     switch (err.code) {
  //         case "P2002":
  //             return res.status(409).json({
  //                 status: 409,
  //                 message:
  //                     "A record already exists with the same details for this action.",
  //                 success: false,
  //                 details: err,
  //             });
  //         default:
  //             return res.status(400).json({
  //                 status: 400,
  //                 message: err.message,
  //                 success: false,
  //                 details: err,
  //             });
  //     }
  // }
  else {
    const customError = err as CustomError;
    const response: ResponseError = {
      message: customError.message,
      status: customError.status,
      success: customError.success,
      data: customError.data,
      details: customError.details,
      stack: customError.stack,
    } as ResponseError;
    res.status(customError.status!).json(response);
  }
}
