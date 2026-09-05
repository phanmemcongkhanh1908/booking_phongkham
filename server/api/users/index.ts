import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../core/security.js";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { z } from "zod";
import { BadRequestError } from "../../core/errors.js";

const usersRouter = Router();

usersRouter.use(requireAuth);

const CreateUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
  roleId: z.string().uuid("Role không hợp lệ").optional(),
});

usersRouter.post("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    const { email, password, roleId } = CreateUserSchema.parse(req.body);

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      throw new BadRequestError("Email này đã được sử dụng");
    }

    let targetRoleId = roleId;
    if (!targetRoleId) {
      const defaultRole = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
      if (defaultRole.length > 0) {
        targetRoleId = defaultRole[0].id;
      }
    }

    const hashedPassword = await hashPassword(password);
    
    const newUser = await db.insert(users).values({
      email,
      passwordHash: hashedPassword,
      roleId: targetRoleId,
    }).returning();

    res.json({
      success: true,
      data: {
        id: newUser[0].id,
        email: newUser[0].email,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default usersRouter;
