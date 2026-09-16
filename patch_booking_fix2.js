import fs from 'fs';
let file = 'src/pages/public/Booking.tsx';
let code = fs.readFileSync(file, 'utf8');

// I'll just use indexOf to be precise
const start = code.indexOf('{/* Desktop Full Stepper */}');
if (start !== -1) {
    const end = code.indexOf('{/* Mobile Compact Progress Bar */}', start);
    let slice = code.substring(start, end);
    // Find the last closing div in this slice
    const lastDiv = slice.lastIndexOf('</div>');
    slice = slice.substring(0, lastDiv + 6) + ')}' + slice.substring(lastDiv + 6);
    
    code = code.substring(0, start) + slice + code.substring(end);
}

// wait, the error is at 279. What is there now?
fs.writeFileSync(file, code);
