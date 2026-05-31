// src/types/express/index.d.ts

export { };

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        username: string;
      };
    }
  }
}

import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      user_id: string;
      username: string;
    };
  }
}