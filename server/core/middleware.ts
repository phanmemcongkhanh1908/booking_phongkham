import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, UnauthorizedError, ForbiddenError } from "./errors.js";
import { verifyToken, TokenPayload } from "./security.js";

// Mở rộng interface Request của Express để chứa thông tin User
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Vui lòng đăng nhập để tiếp tục");
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    
    req.user = payload;
    next();
  } catch (error) {
    next(new UnauthorizedError("Token không hợp lệ hoặc đã hết hạn"));
  }
};

export const requirePermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      // Admin mặc định có toàn quyền (*) hoặc ("all")
      const hasPermission = req.user.permissions.includes("*") || req.user.permissions.includes("all") || req.user.permissions.includes(requiredPermission);
      
      if (!hasPermission) {
        throw new ForbiddenError("Bạn không có quyền thực hiện hành động này");
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Global Error Handler Middleware
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu đầu vào không hợp lệ",
        details: err.issues,
      },
    });
  }

  console.error("[Unhandled Error]", err);
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Đã xảy ra lỗi hệ thống cục bộ",
    },
  });
};
