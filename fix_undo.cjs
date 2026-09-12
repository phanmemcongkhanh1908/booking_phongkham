const fs = require('fs');
const file = 'server/api/admin/index.ts';
let code = fs.readFileSync(file, 'utf8');

const badInsert = `    if (idleTimeoutMinutes !== undefined) {
      await db.insert(settings)
        .values({ id: 'idleTimeoutMinutes', value: idleTimeoutMinutes })
        .onConflictDoUpdate({ target: settings.id, set: { value: idleTimeoutMinutes } });
    }
    
    res.json({ success: true });
  } catch (error) {`;
  
code = code.replace(badInsert, `    res.json({ success: true });\n  } catch (error) {`);
fs.writeFileSync(file, code);
