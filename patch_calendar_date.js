import fs from 'fs';
let file = 'src/pages/admin/CalendarView.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = "const [date, setDate] = useState(new Date());";
code = code.replace(anchor, "");

// put it before the useEffect that uses it
// Let's find where to put it. 
const useEffectStart = `  useEffect(() => {
    if (onRangeChange) {`;
code = code.replace(useEffectStart, anchor + "\n" + useEffectStart);

fs.writeFileSync(file, code);
