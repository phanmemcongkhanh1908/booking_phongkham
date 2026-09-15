import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️ [CẢNH BÁO BẢO MẬT] Biến môi trường JWT_SECRET chưa được cấu hình.");
    console.warn("⚠️ Khởi tạo khóa ngẫu nhiên mật mã cho phiên chạy hiện tại.");
  }
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
}
const SECRET = JWT_SECRET;

const JWT_EXPIRES_IN = "24h";

export interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  tenantId?: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await argon2.verify(hash, password);
};

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, SECRET) as TokenPayload;
};
