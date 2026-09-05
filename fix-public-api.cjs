const fs = require('fs');

let content = fs.readFileSync('server/api/public/index.ts', 'utf8');

const newEndpoint = `
publicRouter.get("/appointments/:id", async (req, res, next) => {
  try {
    const result = await db.select({
      id: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      status: appointments.status,
      serviceName: services.name,
      providerName: providers.name,
      patientName: patients.fullName
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(providers, eq(appointments.providerId, providers.id))
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .where(eq(appointments.id, req.params.id))
    .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Appointment not found" } });
    }

    res.json({ success: true, data: result[0] });
  } catch (error) {
    next(error);
  }
});
`;

if (!content.includes('/appointments/:id')) {
  content = content.replace('export default publicRouter;', newEndpoint + '\nexport default publicRouter;');
  fs.writeFileSync('server/api/public/index.ts', content);
}

