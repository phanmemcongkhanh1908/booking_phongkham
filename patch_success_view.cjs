const fs = require('fs');
let code = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

const storeDestructureTarget = `    telegramBotUsername 
  } = useBookingStore();`;

const storeDestructureReplace = `    telegramBotUsername,
    bookingFormConfig
  } = useBookingStore();`;

code = code.replace(storeDestructureTarget, storeDestructureReplace);

const listTarget = `        <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
            <span>Vui lòng mang theo <strong>CCCD / Căn cước</strong> hoặc <strong>BHYT</strong> (nếu có) để đối chiếu thông tin và làm thủ tục hành chính nhanh chóng.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
            <span>Quý khách nên có mặt trước giờ hẹn <strong>10 phút</strong> để nhân viên lễ tân hỗ trợ chuẩn bị hồ sơ y tế tốt nhất.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
            <span>Vì lý do chuyên môn, nếu quý khách đến trễ quá 15 phút, phòng khám có thể sẽ linh động sắp xếp khung giờ tiếp theo để không ảnh hưởng đến bệnh nhân khác.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
            <span>Nếu có thay đổi, vui lòng thông báo hủy hoặc dời lịch trước <strong>24h</strong> qua hotline <strong>{phone || 'phòng khám'}</strong>.</span>
          </li>
        </ul>`;

const listReplace = `        <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
          {bookingFormConfig?.preVisitNotes?.map((note: string, index: number) => {
            // Very simple markdown bold parser for **text**
            const parts = note.split(/\\*\\*(.*?)\\*\\*/g);
            return (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                <span>
                  {parts.map((part, i) => 
                    i % 2 === 1 ? <strong key={i} className="text-slate-800">{part}</strong> : part
                  )}
                </span>
              </li>
            );
          })}
        </ul>`;

code = code.replace(listTarget, listReplace);

fs.writeFileSync('src/pages/public/components/SuccessView.tsx', code);
console.log('SuccessView.tsx patched');
