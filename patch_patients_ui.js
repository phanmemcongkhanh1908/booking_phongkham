import fs from 'fs';
let file = 'src/pages/admin/Patients.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = "const [patients, setPatients] = useState<any[]>([]);";
code = code.replace(anchor, anchor + `
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);`);

const fetchTarget = `  const fetchPatients = async () => {
    try {
      const res = await api.get('/patients');
      if (res.data.success) {
        setPatients(res.data.data);
      }`;
      
const fetchReplace = `  const fetchPatients = async (fetchPage = page) => {
    try {
      const res = await api.get('/patients', { params: { page: fetchPage, limit: 50 } });
      if (res.data.success) {
        setPatients(res.data.data);
        if (res.data.pagination) {
           setTotalPages(res.data.pagination.totalPages);
           setTotalItems(res.data.pagination.total);
        }
      }`;

code = code.replace(fetchTarget, fetchReplace);

// add paginator UI at the end of the table
const tableEnd = `                </tbody>
              </table>
            </div>`;

const paginatorStr = `                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                <div className="text-sm text-slate-500">
                  Hiển thị trang <span className="font-semibold text-slate-900">{page}</span> / <span className="font-semibold text-slate-900">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, page - 1);
                      setPage(newPage);
                      fetchPatients(newPage);
                    }}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Trang trước
                  </button>
                  <button
                    onClick={() => {
                      const newPage = Math.min(totalPages, page + 1);
                      setPage(newPage);
                      fetchPatients(newPage);
                    }}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}`;

code = code.replace(tableEnd, paginatorStr);

fs.writeFileSync(file, code);
