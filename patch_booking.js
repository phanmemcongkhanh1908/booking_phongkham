import fs from 'fs';
let file = 'src/pages/public/Booking.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = "const location = useLocation();";
code = code.replace(anchor, anchor + `
  const searchParams = new URLSearchParams(location.search);
  const isCompact = searchParams.get('compact') === 'true' || window.self !== window.top;
`);

code = code.replace(
  '<header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">',
  '{!isCompact && (<header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">'
);

code = code.replace(
  '        </div>\n      </header>',
  '        </div>\n      </header>)}'
);

code = code.replace(
  '<main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6 pb-24 lg:pb-8">',
  '<main className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 ${isCompact ? "py-2 space-y-3 pb-safe" : "py-4 sm:py-8 space-y-5 sm:space-y-6 pb-24 lg:pb-8"}`}>'
);

code = code.replace(
  '<div className="hidden sm:block rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-sm">',
  '{!isCompact && (<div className="hidden sm:block rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-sm">'
);

code = code.replace(
  '            </div>\n          </section>',
  '            </div>\n          )}</section>'
); // wait this is risky. Let's just modify the classes if we can't be sure about structure.

fs.writeFileSync(file, code);
