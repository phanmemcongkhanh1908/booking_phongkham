const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/DateTimeSelection.tsx', 'utf8');

// The line is: {providers.length > 1 && (
// Let's replace it with {providers.length > 0 && (
content = content.replace("{providers.length > 1 && (", "{providers.length > 0 && (");

// And also fix Waitlist to actually show a Toast.
content = content.replace("Đăng ký Waitlist", "Đăng ký Waitlist");
content = content.replace(
    `<button type="button" className="whitespace-nowrap px-4 py-2 bg-white text-teal-700 font-bold text-[13px] rounded-xl border border-teal-200 hover:bg-teal-50 transition-colors shadow-sm">
            Đăng ký Waitlist
          </button>`,
    `<button type="button" onClick={() => toast.success('Đăng ký Waitlist thành công! Hệ thống sẽ thông báo khi có lịch trống.')} className="whitespace-nowrap px-4 py-2 bg-white text-teal-700 font-bold text-[13px] rounded-xl border border-teal-200 hover:bg-teal-50 transition-colors shadow-sm cursor-pointer">
            Đăng ký Waitlist
          </button>`
);

fs.writeFileSync('src/pages/public/components/DateTimeSelection.tsx', content);
