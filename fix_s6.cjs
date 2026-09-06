const fs = require('fs');
const path = 'server/core/telegram.ts';
let content = fs.readFileSync(path, 'utf8');

const s6Fix = `
      bot.on('callback_query', async (query: any) => {
        if (!query.data || !query.message) return;
        
        if (currentChatId && query.message.chat.id.toString() !== currentChatId.toString()) {
           await bot?.answerCallbackQuery(query.id, { text: 'Bạn không có quyền thực hiện thao tác này.', show_alert: true });
           return;
        }
        
        const [action, appointmentId] = query.data.split('_');

        try {
          if (action === 'CONFIRM' || action === 'CANCEL') {
            const nextStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'CANCEL_CLINIC';
            
            const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
            if (existing.length === 0) return;
            
            // Basic validity check (cannot confirm/cancel completed or already cancelled appts)
            if (['COMPLETED', 'CANCELLED', 'CANCEL_CLINIC', 'CANCEL_PATIENT', 'NO_SHOW'].includes(existing[0].status)) {
               await bot?.answerCallbackQuery(query.id, { text: 'Lịch hẹn đã kết thúc hoặc đã hủy trước đó.', show_alert: true });
               return;
            }
`;

content = content.replace(
  /bot\.on\('callback_query', async \(query: any\) => \{\n\s*if \(!query\.data \|\| !query\.message\) return;\n\s*const \[action, appointmentId\] = query\.data\.split\('_'\);\n\s*try \{\n\s*if \(action === 'CONFIRM' \|\| action === 'CANCEL'\) \{\n\s*const nextStatus = action === 'CONFIRM' \? 'CONFIRMED' : 'CANCEL_CLINIC';/m,
  s6Fix
);

fs.writeFileSync(path, content);
