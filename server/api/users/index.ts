import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../core/security.js";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "../../core/errors.js";

const usersRouter = Router();

usersRouter.use(requireAuth);

const CreateUserSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên").optional(),
  roleId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  uiMode: z.string().optional(),
  slug: z.string().optional(),
}).refine(data => !!(data.username?.trim() || data.email?.trim()), {
  message: "Vui lòng nhập tên tài khoản hoặc email",
});

const UpdateUserSchema = z.object({
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên").optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  uiMode: z.string().optional(),
  slug: z.string().optional(),
});

usersRouter.get("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    const isFullAdmin = !req.user?.tenantId && (req.user?.role === "admin" || req.user?.permissions?.includes("*") || req.user?.permissions?.includes("all"));
    let userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        roleName: roles.name,
        permissions: users.permissions,
        rolePermissions: roles.permissions,
        tenantId: users.tenantId,
        uiMode: users.uiMode,
        slug: users.slug,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    if (!isFullAdmin) {
      const myTenantId = req.user?.tenantId;
      userRecords = userRecords.filter((u: any) => u.tenantId === myTenantId);
    }
    
    res.json({ success: true, data: userRecords });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    console.log("[Users API] Creating new user account...");
    console.log("[Users API] Request body keys:", Object.keys(req.body));
    console.log("[Users API] Initiator user ID:", req.user?.userId, "Tenant:", req.user?.tenantId);
    
    const { email, username, password, roleId, permissions, uiMode, slug } = CreateUserSchema.parse(req.body);
    const rawIdentifier = (username || email || "").trim();
    const identifier = rawIdentifier.toLowerCase();
    
    console.log("[Users API] Target identifier:", identifier, "Role:", roleId, "Permissions:", permissions);

    if (rawIdentifier.length < 2) {
      console.warn("[Users API] Creation failed: identifier too short.");
      throw new BadRequestError("Tên tài khoản phải có ít nhất 2 ký tự");
    }

    if (!password) {
      console.warn("[Users API] Creation failed: password missing.");
      throw new BadRequestError("Vui lòng nhập mật khẩu");
    }

    // Kiểm tra trùng lặp không phân biệt hoa thường
    const existingUsers = await db.select().from(users);
    const existing = existingUsers.find(
      (u: any) => (u.email || "").trim().toLowerCase() === identifier
    );
    if (existing) {
      console.warn("[Users API] Creation failed: identifier already exists.");
      throw new BadRequestError(`Tên tài khoản hoặc email '${rawIdentifier}' đã tồn tại trong hệ thống.`);
    }

    let targetRoleId = roleId;
    const isFullAdmin = !permissions || permissions.length === 0 || permissions.includes("*") || permissions.includes("all");
    console.log("[Users API] Is considered Full Admin (based on requested permissions):", isFullAdmin);
    
    if (!targetRoleId) {
      if (isFullAdmin) {
        const allRoles = await db.select().from(roles);
        const defaultRole = allRoles.find(
          (r: any) => (r.name || "").trim().toLowerCase() === "admin"
        );
        if (defaultRole) {
          targetRoleId = defaultRole.id;
        } else {
          targetRoleId = "role-admin";
        }
        console.log("[Users API] Assigned default admin role ID:", targetRoleId);
      } else {
        targetRoleId = null;
        console.log("[Users API] No role assigned.");
      }
    } else {
      console.log("[Users API] Using explicitly requested role ID:", targetRoleId);
    }

    const hashedPassword = await hashPassword(password);
    
    // Nếu người tạo có tenantId, tài khoản con kế thừa tenantId đó.
    // Nếu là admin gốc (không có tenantId) tạo tài khoản mới (và không phải đang tạo thêm admin gốc), cấp 1 tenantId mới cho phòng khám.
    let newTenantId = req.user?.tenantId;
    if (!newTenantId && !isFullAdmin) { 
       newTenantId = "tenant-" + Date.now().toString();
       console.log("[Users API] Root admin created clinic admin. Generated new tenantId:", newTenantId);
    } else if (newTenantId) {
       console.log("[Users API] Inheriting tenantId from creator:", newTenantId);
    } else {
       console.log("[Users API] Creating another root admin (no tenantId).");
    }

    console.log("[Users API] Inserting user into database...");
    const newUser = await db.insert(users).values({
      email: identifier,
      passwordHash: hashedPassword,
      roleId: targetRoleId,
      tenantId: newTenantId,
      isActive: true,
      permissions: permissions || [],
      uiMode,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();
    
    console.log("[Users API] User inserted successfully. User ID:", newUser[0]?.id);

    res.json({
      success: true,
      message: `Tạo tài khoản '${rawIdentifier}' thành công!`,
      data: {
        id: newUser[0]?.id || "new-user",
        email: identifier,
        username: rawIdentifier,
        isActive: true,
        permissions: permissions || [],
      uiMode,
      slug,
      },
    });
  } catch (error) {
    console.error("[Users API] Account creation error:", error);
    next(error);
  }
});

usersRouter.put("/:id", requirePermission("user.create"), async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { password, isActive, permissions, uiMode, slug } = UpdateUserSchema.parse(req.body);

    const existingUsers = await db.select().from(users).where(eq(users.id, userId));
    if (existingUsers.length === 0) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    if (existingUsers[0].email === "admin@dentalsmartbooking.com" && typeof isActive === 'boolean' && !isActive) {
      throw new BadRequestError("Không thể khóa tài khoản admin tối cao");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (uiMode !== undefined) updateData.uiMode = uiMode;
    if (slug !== undefined) updateData.slug = slug;
    if (permissions) {
      updateData.permissions = permissions;
    }

    const updated = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", requirePermission("user.create"), async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    const targetUser = await db.select().from(users).where(eq(users.id, userId));
    if (targetUser.length > 0 && targetUser[0].email === "admin@dentalsmartbooking.com") {
      throw new BadRequestError("Không thể xóa tài khoản admin tối cao");
    }

    // Ngăn chặn xóa chính mình
    if (req.user?.userId === userId) {
      throw new BadRequestError("Không thể xóa tài khoản đang đăng nhập");
    }

    await db.delete(users).where(eq(users.id, userId));
    res.json({ success: true, message: "Đã xóa tài khoản" });
  } catch (error) {
    next(error);
  }
});

export default usersRouter;
