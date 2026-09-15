const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Patients.tsx', 'utf8');

// Replace fetchPatients
const targetFetch = `  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await api.get('/patients');
      if (res.data?.success) {
        setPatients(res.data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách bệnh nhân');
    } finally {
      setLoading(false);
    }
  };`;

const replaceFetch = `  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPatients = async (pageNum = 1, append = false) => {
    try {
      if (append) setIsLoadingMore(true);
      else setLoading(true);
      
      const res = await api.get(\`/patients?page=\${pageNum}&limit=50\`);
      if (res.data?.success) {
        if (append) {
          setPatients(prev => {
            const newPatients = res.data.data;
            const existingIds = new Set(prev.map(p => p.id));
            const filteredNew = newPatients.filter(p => !existingIds.has(p.id));
            return [...prev, ...filteredNew];
          });
        } else {
          setPatients(res.data.data);
        }
        setHasMore(res.data.pagination?.hasMore || false);
        setPage(pageNum);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách bệnh nhân');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;
    fetchPatients(page + 1, true);
  };`;

code = code.replace(targetFetch, replaceFetch);

// Let's add the Load More button at the end of the patient list
const targetListEnd = `            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className={\`p-3 cursor-pointer transition-colors border-b last:border-0 \${
                  isSelected ? 'bg-teal-50 border-teal-200' : 'hover:bg-slate-50 border-slate-100'
                }\`}
              >`;

const targetMap = `{filteredPatients.map(p => {`;
const replaceMap = `{filteredPatients.map(p => {`; // just locating

const listContainerTarget = `        {/* Patient List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredPatients.map(p => {`;

const listContainerReplace = `        {/* Patient List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredPatients.map(p => {`;

// Actually we just need to append the button after the map finishes
const targetEndMap = `            );
          })}
        </div>`;

const replaceEndMap = `            );
          })}
          
          {hasMore && filteredPatients.length === patients.length && (
            <div className="p-3 flex justify-center">
              <button 
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tải thêm bệnh nhân'}
              </button>
            </div>
          )}
        </div>`;

code = code.replace(targetEndMap, replaceEndMap);
fs.writeFileSync('src/pages/admin/Patients.tsx', code);
console.log('Patients frontend pagination added.');
