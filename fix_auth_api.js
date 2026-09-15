import fs from 'fs';
let file = 'server/api/auth/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(`    const token = generateToken({
      userId: user.id,
      role: user.roleName || "guest",
      permissions: mergedPermissions,
      tenantId: user.tenantId,
          uiMode: user.uiMode,
          slug: user.slug,
    });`, `    const token = generateToken({
      userId: user.id,
      role: user.roleName || "guest",
      permissions: mergedPermissions,
      tenantId: user.tenantId,
    });`);
    
code = code.replace(`        user: {
          id: user.id,
          email: user.email,
          role: user.roleName,
          permissions: mergedPermissions,
          tenantId: user.tenantId,
        },`, `        user: {
          id: user.id,
          email: user.email,
          role: user.roleName,
          permissions: mergedPermissions,
          tenantId: user.tenantId,
          uiMode: user.uiMode,
          slug: user.slug,
        },`);

fs.writeFileSync(file, code);
