const createTable = (tableName: string): any => {
  return new Proxy({ _name: tableName }, {
    get: (target: any, prop: any) => {
      if (prop === '_name') return target._name;
      if (typeof prop === 'string') {
        return { _name: tableName, _col: prop };
      }
      return Reflect.get(target, prop);
    }
  });
};

export const roles: any = createTable("roles");
export const users: any = createTable("users");
export const patients: any = createTable("patients");
export const providers: any = createTable("providers");
export const services: any = createTable("services");
export const providerServices: any = createTable("provider_services");
export const resources: any = createTable("resources");
export const appointments: any = createTable("appointments");
export const appointmentHolds: any = createTable("appointment_holds");
export const auditLogs: any = createTable("audit_logs");
export const waitlist: any = createTable("waitlist");
export const patientRecalls: any = createTable("patient_recalls");
export const pushSubscriptions: any = createTable("push_subscriptions");
export const settings: any = createTable("settings");

export const patientsRelations: any = {};
export const appointmentsRelations: any = {};
