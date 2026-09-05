const fs = require('fs');

let content = fs.readFileSync('server/core/telegram.ts', 'utf8');

content = content.replace(`export const sendNewAppointmentAlert = async (appointmentId: string) => {  if (!bot || !chatId) return;`, `export const sendNewAppointmentAlert = async (appointmentId: string) => {  if (!bot || !currentChatId) return;\n  const chatId = currentChatId;`);

const sendPatient = `
export const sendPatientReminder = async (telegramId: string, appointmentData: any, clinicData: any) => {
  if (!bot || !telegramId) return false;
  try {
    const clinicName = clinicData?.clinicName || "Phòng khám nha khoa";
    const hotline = clinicData?.phone || "";
    
    const message = \`🔔 *THÔNG BÁO NHẮC LỊCH HẸN*\n\n\`
      + \`Kính gửi quý khách \${appointmentData.patientName},\n\`
      + \`\${clinicName} xin nhắc lịch hẹn của quý khách:\n\n\`
      + \`🦷 Dịch vụ: \${appointmentData.serviceName}\n\`
      + \`👨‍⚕️ Bác sĩ: \${appointmentData.providerName}\n\`
      + \`⏰ Thời gian: \${format(appointmentData.startAt, "HH:mm dd/MM/yyyy")}\n\n\`
      + \`Rất mong quý khách sắp xếp thời gian đến đúng giờ. Nếu cần hỗ trợ, vui lòng liên hệ \${hotline}.\n\`
      + \`Trân trọng!\`;

    await bot.sendMessage(telegramId, message, {
      parse_mode: 'Markdown'
    });
    return true;
  } catch (error) {
    console.error("Failed to send Telegram reminder to patient:", error);
    return false;
  }
};
`;

content += sendPatient;
fs.writeFileSync('server/core/telegram.ts', content, 'utf8');
