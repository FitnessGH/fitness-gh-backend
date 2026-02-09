declare module "@vercel/blob" {
  export interface PutBlobResult {
    url: string;
    pathname: string;
    contentType?: string | null;
    contentDisposition?: string | null;
  }

  export interface PutOptions {
    access?: "public" | "private";
    contentType?: string;
  }

  export function put(
    path: string,
    data: ArrayBuffer | Uint8Array | Buffer,
    options?: PutOptions,
  ): Promise<PutBlobResult>;
}

