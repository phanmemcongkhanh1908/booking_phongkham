import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword, generateToken } from "../../core/security.js";
import { LoginSchema } from "../../../shared/schemas.js";
import { BadRequestError, UnauthorizedError } from "../../core/errors.js";

const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    // Tìm user và join với role
    const userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        roleName: roles.name,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email))
      .limit(1);

    if (userRecords.length === 0) {
      throw new UnauthorizedError("Email hoặc mật khẩu không chính xác");
    }

    const user = userRecords[0];

    if (!user.isActive) {
      throw new UnauthorizedError("Tài khoản đã bị khóa");
    }

    // Verify mật khẩu
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Email hoặc mật khẩu không chính xác");
    }

    // Generate Token
    const token = generateToken({
      userId: user.id,
      role: user.roleName || "guest",
      permissions: (user.permissions as string[]) || [],
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.roleName,
          permissions: user.permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
