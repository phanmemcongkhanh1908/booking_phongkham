const fs = require('fs');
const path = 'server/api/admin/index.ts';
let content = fs.readFileSync(path, 'utf8');

const faultyStr2 = `    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
});
  } catch (error) {
    next(error);
  }
});

// Cập nhật cài đặt hệ thống`;

const fixedStr2 = `    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
});

// Cập nhật cài đặt hệ thống`;

content = content.replace(faultyStr2, fixedStr2);

fs.writeFileSync(path, content);
