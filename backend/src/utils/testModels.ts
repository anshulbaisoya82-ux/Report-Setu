import { prisma } from '../config/prisma';
import { UserRole } from '../generated/prisma/client';

type ModelName =
  | 'user'
  | 'doctorProfile'
  | 'patientProfile'
  | 'report'
  | 'prescription'
  | 'appointment'
  | 'chatMessage'
  | 'connection'
  | 'notification'
  | 'medicineSchedule'
  | 'auditLog'
  | 'doctorNote'
  | 'refreshToken'
  | 'otp'
  | 'connectCode';

const delegates = prisma as any;

const normalize = (value: any): any => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof Date) return value;
  const result = { ...value };
  if (result._id !== undefined) {
    result.id = result._id;
    delete result._id;
  }
  delete result.connectedDoctors;
  delete result.initiatedBy;
  if (result.$set) Object.assign(result, result.$set);
  delete result.$set;
  if (result.$unset) {
    for (const key of Object.keys(result.$unset)) result[key] = null;
    delete result.$unset;
  }
  if (result.$inc) {
    for (const [key, increment] of Object.entries(result.$inc)) {
      result[key] = { increment };
    }
    delete result.$inc;
  }
  if (result.status === 'active') result.status = 'connected';
  if (result.type === 'In-person') result.type = 'In_person';
  if (result.type === 'Video call') result.type = 'Video_call';
  if (result.type === 'Phone call') result.type = 'Phone_call';
  if (result.state === 'due') result.state = 'Pending';
  if (['taken', 'missed', 'snoozed'].includes(result.state)) {
    result.state = result.state[0].toUpperCase() + result.state.slice(1);
  }
  if (result.experienceYears !== undefined) delete result.experienceYears;
  if (result.hospital !== undefined) {
    result.clinic = { ...(result.clinic || {}), name: result.hospital };
    delete result.hospital;
  }
  if (result.rating !== undefined) delete result.rating;
  for (const key of Object.keys(result)) {
    if (key !== '$inc') result[key] = normalize(result[key]);
  }
  return result;
};

const normalizeWhere = (value: any): any => {
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalizeWhere);
  const result = normalize(value);
  if (result.$or) {
    result.OR = result.$or.map(normalizeWhere);
    delete result.$or;
  }
  if (result.$and) {
    result.AND = result.$and.map(normalizeWhere);
    delete result.$and;
  }
  return result;
};

const hydrate = (value: any, name?: ModelName): any => {
  if (!value) return value;
  if (Array.isArray(value)) return value.map((item) => hydrate(item, name));
  const result: any = { ...value, _id: value.id };
  for (const key of Object.keys(result)) {
    if (result[key] === null) result[key] = undefined;
  }
  if (name === 'connection' && result.status === 'connected') {
    result.status = 'active';
  }
  if (name === 'patientProfile') {
    if (!result.connectedDoctors) result.connectedDoctors = [];
  }
  result.save = async function () {
    if (!name) return result;
    const { save, _id, id, connectedDoctors, ...cleanData } = result;
    const updated = await delegates[name].update({
      where: { id },
      data: normalize(cleanData),
    });
    const hydratedUpdated = hydrate(updated, name);
    if (name === 'patientProfile' && connectedDoctors) {
      hydratedUpdated.connectedDoctors = connectedDoctors;
    }
    return hydratedUpdated;
  };
  return result;
};

const defaults = (name: ModelName): Record<string, unknown> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (name === 'user') return { role: UserRole.patient, isActive: true, isVerified: false };
  if (name === 'patientProfile') {
    return {
      rsId: `RS-${suffix}`,
      name: 'Test Patient',
      phone: `+919${Date.now().toString().slice(-9)}`,
      age: 30,
      gender: 'Other',
      bloodGroup: 'Unknown',
      location: 'New Delhi',
      status: 'Normal',
      conditions: [],
    };
  }
  if (name === 'doctorProfile') {
    return {
      name: 'Test Doctor',
      email: `doctor-${suffix}@test.local`,
      phone: `+919${Date.now().toString().slice(-9)}`,
      registrationNumber: `TEST-${suffix}`,
      medicalCouncil: 'Test Medical Council',
      specialty: 'General Medicine',
      clinic: {},
    };
  }
  return {};
};

const makeModel = (name: ModelName): any => {
  const delegate = delegates[name];
  return {
    create: async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input.map((item) => (makeModel(name) as any).create(item)));
      if (input && typeof input === 'object' && Object.keys(input).every((key) => /^\d+$/.test(key))) {
        return Promise.all(Object.values(input).map((item) => (makeModel(name) as any).create(item)));
      }
      const data = input?.data ?? input;
      const normalized = { ...defaults(name), ...normalize(data) };
      if ((name === 'doctorProfile' || name === 'patientProfile') && !normalized.userId) {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              ...(typeof normalized.email === 'string' ? [{ email: normalized.email }] : []),
              ...(typeof normalized.phone === 'string' ? [{ phone: normalized.phone }] : []),
            ],
          },
        });
        if (user) normalized.userId = user.id;
      }
      return hydrate(await delegate.create({ data: normalized }), name);
    },
    find: (where: any = {}) => {
      const execute = (args: any = {}) => delegate.findMany(args).then((r: any) => hydrate(r, name));
      const query: any = execute({ where: normalizeWhere(where) });
      query.sort = (sort: Record<string, 1 | -1>) => execute({
        where: normalizeWhere(where),
        orderBy: Object.fromEntries(Object.entries(sort).map(([key, value]) => [key, value === 1 ? 'asc' : 'desc'])),
      });
      query.then = query.then.bind(query);
      return query;
    },
    findOne: async (where: any = {}) => hydrate(await delegate.findFirst({ where: normalizeWhere(where) }), name),
    findById: async (id: string) => {
      const row = await delegate.findUnique({ where: { id } });
      const hyd = hydrate(row, name);
      if (hyd && name === 'patientProfile') {
        const conns = await prisma.connection.findMany({ where: { patientId: id, status: 'connected' } });
        hyd.connectedDoctors = Array.from(new Set([...(hyd.connectedDoctors || []), ...conns.map((c: any) => c.doctorId)]));
      }
      return hyd;
    },
    countDocuments: async (where: any = {}) => delegate.count({ where: normalizeWhere(where) }),
    updateOne: async (where: any, data: any) => delegate.updateMany({ where: normalizeWhere(where), data: normalize(data) }),
    updateMany: async (where: any, data: any) => delegate.updateMany({ where: normalizeWhere(where), data: normalize(data) }),
    deleteMany: async (where: any = {}) => delegate.deleteMany({ where: normalizeWhere(where) }),
    deleteOne: async (where: any) => delegate.deleteMany({ where: normalizeWhere(where) }),
  };
};

export const User = makeModel('user');
export const DoctorProfile = makeModel('doctorProfile');
export const PatientProfile = makeModel('patientProfile');
export const Report = makeModel('report');
export const Prescription = makeModel('prescription');
export const Appointment = makeModel('appointment');
export const ChatMessage = makeModel('chatMessage');
export const Connection = makeModel('connection');
export const Notification = makeModel('notification');
export const MedicineSchedule = makeModel('medicineSchedule');
export const AuditLog = makeModel('auditLog');
export const DoctorNote = makeModel('doctorNote');
export const RefreshToken = makeModel('refreshToken');
export const Otp = makeModel('otp');
export const ConnectCode = makeModel('connectCode');
