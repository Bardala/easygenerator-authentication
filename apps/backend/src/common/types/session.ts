import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    createdAt?: number;
    lastSeenAt?: number;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}
