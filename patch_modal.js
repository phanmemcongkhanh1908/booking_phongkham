import fs from 'fs';
let file = 'src/pages/admin/components/CreateAppointmentModal.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200"`;

const newStr = `    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[92vh] mt-auto sm:my-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe"`;

code = code.replace(targetStr, newStr);

// Let's also fix SyncDiagnosticModal
let syncFile = 'src/pages/admin/components/SyncDiagnosticModal.tsx';
let syncCode = fs.readFileSync(syncFile, 'utf8');

const targetSync = `    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">`;

const newSync = `    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[90vh] mt-auto sm:my-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe">`;

syncCode = syncCode.replace(targetSync, newSync);
fs.writeFileSync(syncFile, syncCode);

fs.writeFileSync(file, code);
