import { loadStore } from "./server/db/index.js";
import { db } from "./server/db/index.js";
import { users, roles } from "./server/db/schema.js";
import { eq } from "drizzle-orm";

async function test() {
  const userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        roleName: roles.name,
        rolePermissions: roles.permissions,
        userPermissions: users.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));
      
  console.log(JSON.stringify(userRecords, null, 2));
}
test();
