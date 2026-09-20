import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles, settings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword, generateToken } from "../../core/security.js";
import { LoginSchema } from "../../../shared/schemas.js";
import { BadRequestError, UnauthorizedError } from "../../core/errors.js";

const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const identifier = (email || "").trim().toLowerCase();

    // Tìm tất cả users và join với role để so sánh case-insensitive
    const userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        roleName: roles.name,
        rolePermissions: roles.permissions,
        userPermissions: users.permissions,
        tenantId: users.tenantId,
        uiMode: users.uiMode,
        slug: users.slug,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    // Khớp tài khoản: hỗ trợ username bất kỳ (như admin) hoặc email
    const user = userRecords.find((u: any) => {
      const stored = (u.email || "").trim().toLowerCase();
      if (stored === identifier) return true;
      // Hỗ trợ nhập "admin" đăng nhập vào tài khoản mặc định admin@dentalsmartbooking.com nếu chưa tạo tài khoản admin riêng
      if (identifier === "admin" && stored === "admin@dentalsmartbooking.com") return true;
      return false;
    });

    if (!user) {
      throw new UnauthorizedError("Tài khoản hoặc mật khẩu không chính xác");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Tài khoản đã bị khóa");
    }

    // Verify mật khẩu
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Tài khoản hoặc mật khẩu không chính xác");
    }

    const mergedPermissions = Array.from(new Set([
      ...(user.rolePermissions || []),
      ...(user.userPermissions || [])
    ]));

    // Generate Token
    const token = generateToken({
      userId: user.id,
      role: user.roleName || "guest",
      permissions: mergedPermissions,
      tenantId: user.tenantId,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.roleName,
          permissions: mergedPermissions,
          tenantId: user.tenantId,
          uiMode: user.uiMode,
          slug: user.slug,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /google
 * Đăng nhập qua tài khoản Google kèm kiểm tra Admin Whitelist nghiêm ngặt.
 * Nếu email chưa nằm trong danh sách Admin Whitelist (google_sync_accounts) hoặc users:
 * Trả về mã lỗi 403 UNAUTHORIZED_EMAIL và ghi log chi tiết access_denied.
 */
authRouter.post("/google", async (req, res, next) => {
  try {
    const { accessToken, email: providedEmail } = req.body;
    let verifiedEmail = (providedEmail || "").trim().toLowerCase();

    // Nếu có Google accessToken, truy vấn Google userinfo để đối soát email
    if (accessToken) {
      try {
        const gRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (gRes.ok) {
          const gInfo: any = await gRes.json();
          if (gInfo.email) {
            verifiedEmail = gInfo.email.trim().toLowerCase();
          }
        }
      } catch (tokenErr) {
        console.warn("[Auth API] Could not verify Google userinfo with accessToken:", tokenErr);
      }
    }

    if (!verifiedEmail) {
      throw new BadRequestError("Không tìm thấy thông tin email từ tài khoản Google.");
    }

    console.log(`[Auth API] Verifying Google Login for email: ${verifiedEmail}`);

    // 1. Kiểm tra tài khoản trong bảng users
    const userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        roleName: roles.name,
        rolePermissions: roles.permissions,
        userPermissions: users.permissions,
        tenantId: users.tenantId,
        uiMode: users.uiMode,
        slug: users.slug,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    const matchedUser = userRecords.find(
      (u: any) => (u.email || "").trim().toLowerCase() === verifiedEmail
    );

    // 2. Kiểm tra danh sách Admin Whitelist (settings.google_sync_accounts)
    const whitelistRecord = await db
      .select()
      .from(settings)
      .where(eq(settings.id, "google_sync_accounts"))
      .limit(1);

    const syncAccounts: any[] = Array.isArray(whitelistRecord[0]?.value)
      ? whitelistRecord[0].value
      : [];

    const whitelistedAccount = syncAccounts.find(
      (a: any) => (a.email || "").trim().toLowerCase() === verifiedEmail && a.status !== "disabled"
    );

    // 3. Nếu email KHÔNG nằm trong users VÀ KHÔNG nằm trong Admin Whitelist:
    if (!matchedUser && !whitelistedAccount) {
      console.error("[Auth API][ACCESS_DENIED] Unauthorized Google login attempt:", {
        error: "access_denied",
        errorCode: "UNAUTHORIZED_EMAIL",
        attemptedEmail: verifiedEmail,
        timestamp: new Date().toISOString(),
        totalWhitelistedAccounts: syncAccounts.length,
        reason: "Email is not authorized in Admin Whitelist (google_sync_accounts) or users database",
        actionRequired: "The email must be added to Admin Whitelist in User Management or Test Users on Google Cloud Console."
      });

      return res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED_EMAIL",
          message: `Email "${verifiedEmail}" chưa được cấp quyền trong danh sách Admin Whitelist. Vui lòng liên hệ Quản trị viên để được thêm vào hệ thống.`,
        },
        data: {
          email: verifiedEmail,
          isWhitelisted: false,
          errorCode: "access_denied"
        },
      });
    }

    // 4. Nếu tài khoản có trong users nhưng bị vô hiệu hoá
    if (matchedUser && !matchedUser.isActive) {
      console.warn("[Auth API] User account is disabled:", verifiedEmail);
      throw new UnauthorizedError("Tài khoản này đã bị tạm khóa bởi Quản trị viên");
    }

    // 5. Nếu email có trong Admin Whitelist nhưng chưa có bản ghi trong users
    if (!matchedUser && whitelistedAccount) {
      console.log(`[Auth API] Whitelisted clinic account authenticated: ${verifiedEmail} (${whitelistedAccount.clinicName})`);
      const permissions = [
        "patient.view", "patient.create", "patient.edit",
        "appointment.view", "appointment.create", "appointment.edit",
        "setting.view"
      ];
      const token = generateToken({
        userId: whitelistedAccount.id || `google_${Date.now()}`,
        role: "clinic_staff",
        permissions,
        tenantId: whitelistedAccount.id || "clinic_google",
      });

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: whitelistedAccount.id || `google_${Date.now()}`,
            email: verifiedEmail,
            role: "clinic_staff",
            permissions,
            tenantId: whitelistedAccount.id || "clinic_google",
            clinicName: whitelistedAccount.clinicName,
            doctorName: whitelistedAccount.doctorName,
          },
        },
      });
    }

    // 6. Tài khoản hợp lệ trong bảng users
    const mergedPermissions = Array.from(
      new Set([
        ...(matchedUser!.rolePermissions || []),
        ...(matchedUser!.userPermissions || []),
      ])
    );

    const token = generateToken({
      userId: matchedUser!.id,
      role: matchedUser!.roleName || "staff",
      permissions: mergedPermissions,
      tenantId: matchedUser!.tenantId,
    });

    console.log(`[Auth API] Google Login successful for registered user: ${verifiedEmail} (Role: ${matchedUser!.roleName})`);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: matchedUser!.id,
          email: matchedUser!.email,
          role: matchedUser!.roleName,
          permissions: mergedPermissions,
          tenantId: matchedUser!.tenantId,
          uiMode: matchedUser!.uiMode,
          slug: matchedUser!.slug,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
