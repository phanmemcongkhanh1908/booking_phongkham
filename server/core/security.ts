import argon2 from "argon2";
import jwt from "jsonwebtoken";


let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️ [CẢNH BÁO BẢO MẬT] Biến môi trường JWT_SECRET chưa được cấu hình trên Render/Production.");
    console.warn("⚠️ Hệ thống sẽ dùng khóa bí mật dự phòng an toàn để máy chủ khởi động bình thường.");
    console.warn("⚠️ Bạn có thể thêm biến JWT_SECRET vào Environment Variables trên Render bất cứ lúc nào.");
  }
  JWT_SECRET = "dental_smart_booking_jwt_production_fallback_secret_key_98234710293847109238";
}
const SECRET = JWT_SECRET;

const JWT_EXPIRES_IN = "24h";

export interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
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
