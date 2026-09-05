const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

// I also missed closing the div properly inside the map loop earlier.
// Wait, I replaced `</td>` with `</div></td>` in the regex block before... Let me double check if it's correct.

// Let's just fix the ending tags for the buttons column directly.
const correctBlock = `                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                          {apt.status === 'REQUESTED' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'CONFIRMED')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-teal-50 text-teal-700 hover:bg-teal-100 border-transparent hover:border-current/10">Xác Nhận</button>
                          )}
                          {apt.status === 'CONFIRMED' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'CHECKED_IN')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-transparent hover:border-current/10">Check-in</button>
                          )}
                          {(apt.status === 'REQUESTED' || apt.status === 'CONFIRMED') && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'CANCEL_CLINIC')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-red-50 text-red-700 hover:bg-red-100 border-transparent hover:border-current/10">Hủy Lịch</button>
                          )}
                          {apt.status === 'CHECKED_IN' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'IN_SERVICE')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-purple-50 text-purple-700 hover:bg-purple-100 border-transparent hover:border-current/10">Đang Khám</button>
                          )}
                          {apt.status === 'IN_SERVICE' && (
                            <button onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')} className="text-xs px-3 py-1.5 rounded-md font-bold shadow-sm border transition-all bg-green-50 text-green-700 hover:bg-green-100 border-transparent hover:border-current/10">Hoàn Thành</button>
                          )}
                          </div>
                        </td>`;

content = content.replace(/<td className="px-4 py-3 text-right">[\s\S]*?<\/td>/, correctBlock);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);

