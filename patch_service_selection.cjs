const fs = require('fs');
let content = fs.readFileSync('src/pages/public/components/ServiceSelection.tsx', 'utf8');

content = content.replace(
  "  isFree?: boolean;",
  `  isFree?: boolean;
  tags?: string[];`
);

content = content.replace(
  "  const filteredServices = useMemo(() => {",
  `  const extendedServices = useMemo(() => {
    // Idea 4: Enhance services with premium tags dynamically for demo
    return services.map(s => {
      let tags: string[] = [];
      if (s.name.toLowerCase().includes('khám') || s.name.toLowerCase().includes('tư vấn')) tags = ['Miễn phí', 'Nhanh chóng'];
      else if (s.name.toLowerCase().includes('nhổ răng') || s.name.toLowerCase().includes('tiểu phẫu')) tags = ['Không đau', 'Công nghệ Piezotome'];
      else if (s.name.toLowerCase().includes('tẩy trắng') || s.name.toLowerCase().includes('thẩm mỹ')) tags = ['Best Seller', 'Trả góp 0%'];
      else if (s.name.toLowerCase().includes('niềng răng') || s.name.toLowerCase().includes('implant')) tags = ['Chuyên sâu', 'Bảo hành trọn đời'];
      else tags = ['Chuẩn Y khoa'];
      return { ...s, tags: s.tags || tags };
    });
  }, [services]);

  const filteredServices = useMemo(() => {`
);

content = content.replace(
  "  }, [services, searchQuery, selectedCategory]);",
  `  }, [extendedServices, searchQuery, selectedCategory]);`
);
content = content.replace(
  "return services.filter(s => {",
  "return extendedServices.filter(s => {"
);

// find where service is rendered. 
// `<div className="flex justify-between items-start mb-2">`
// Add tags above the duration.

content = content.replace(
  "<h4 className=\"font-bold text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-2 pr-2 leading-snug\">\n                    {service.name}\n                  </h4>",
  `<h4 className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-2 pr-2 leading-snug">
                    {service.name}
                  </h4>
                  {service.tags && service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {service.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-teal-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}`
);

fs.writeFileSync('src/pages/public/components/ServiceSelection.tsx', content);
