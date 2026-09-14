const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/UsersManagement.tsx', 'utf8');

const target = `                          <div>
                            (() => {`;

const replace = `                          <div className="w-full">
                            {(() => {`;

code = code.replace(target, replace);

const target2 = `                            })()}
                          </div>
                          {/* Khung hiển thị chi tiết đường dẫn đang chọn & nút thao tác */}`;

const replace2 = `                            })()}
                          </div>
                          {/* Khung hiển thị chi tiết đường dẫn đang chọn & nút thao tác */}`;
// Wait, is there a missing } at the end?
// replaceStr ended with `})()}`
// Since there was no curly brace around it, it was just `})()` in the code. Let's fix both ends.
