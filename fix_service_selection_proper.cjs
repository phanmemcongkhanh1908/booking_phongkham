const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/ServiceSelection.tsx', 'utf8');

// The type is already patched in patch_service_selection.cjs, but let's verify tags exists on Service interface
if (!content.includes('tags?: string[]')) {
    content = content.replace("isFree?: boolean;", "isFree?: boolean;\n  tags?: string[];");
}

// 1. Ensure extendedServices is actually used
content = content.replace("return services.filter(svc => {", "return extendedServices.filter(svc => {");

// 2. Add tags render below the name
const targetText = `<h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                    {svc.name}
                  </h3>`;
                  
const replaceText = `<h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                    {svc.name}
                  </h3>
                  {svc.tags && svc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {svc.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-teal-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}`;

if (content.includes(targetText) && !content.includes('svc.tags.map')) {
    content = content.replace(targetText, replaceText);
}

fs.writeFileSync('src/pages/public/components/ServiceSelection.tsx', content);
