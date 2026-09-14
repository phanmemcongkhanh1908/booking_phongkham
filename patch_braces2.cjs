const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

code = code.replace(
  `                          <div>
                            (() => {`,
  `                          <div className="w-full">
                            {(() => {`
);

code = code.replace(
  `                            })()}
                          </div>
                          {/* Khung hiển thị chi tiết đường dẫn đang chọn & nút thao tác */}`,
  `                            })()}
                          </div>
                          {/* Khung hiển thị chi tiết đường dẫn đang chọn & nút thao tác */}`
);
// wait, the closing was already `})()}` in my previous replacement script?
// Let's check my replaceStr from before. It ended with `})()}`
// Ah, `})()}` actually provides the closing `}` if I just make sure it's there. 

fs.writeFileSync('src/pages/admin/UsersManagement.tsx', code);
