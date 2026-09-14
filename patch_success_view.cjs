const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/SuccessView.tsx', 'utf8');

const targetStr = `        <button
          type="button"
          onClick={handleNewBooking}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm shadow-md transition-colors text-center cursor-pointer"
        >
          Đặt thêm lịch hẹn mới
        </button>
      </div>`;

const replaceStr = `        <button
          type="button"
          onClick={handleNewBooking}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm shadow-md transition-colors text-center cursor-pointer"
        >
          Đặt thêm lịch hẹn mới
        </button>
        <button
          type="button"
          onClick={() => window.location.href = '/book/my-booking'}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-white border-2 border-teal-600 text-teal-700 hover:bg-teal-50 font-extrabold text-sm shadow-sm transition-colors text-center cursor-pointer"
        >
          Tra cứu & Quản lý lịch
        </button>
      </div>`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/pages/public/components/SuccessView.tsx', content);
