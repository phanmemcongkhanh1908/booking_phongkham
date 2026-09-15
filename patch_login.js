import fs from 'fs';
let file = 'src/pages/admin/Login.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldLink = `<Link 
        to="/" 
        className="absolute top-6 left-6 flex items-center text-sm font-medium text-text-muted hover:text-text-main bg-surface px-4 py-2 rounded-full shadow-soft border border-border-subtle transition-all hover:shadow"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại trang khách hàng
      </Link>`;
      
const newLink = `      <Link 
        to={localStorage.getItem('last_clinic_slug') ? \`/booking/\${localStorage.getItem('last_clinic_slug')}\` : "/"} 
        className="absolute top-6 left-6 flex items-center text-sm font-medium text-text-muted hover:text-text-main bg-surface px-4 py-2 rounded-full shadow-soft border border-border-subtle transition-all hover:shadow"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại trang khách hàng
      </Link>`;

code = code.replace(oldLink, newLink);

fs.writeFileSync(file, code);
