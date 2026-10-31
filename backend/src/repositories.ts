import { prisma } from './config/prisma';
import type {
  Appointment as PrismaAppointment,
  Connection as PrismaConnection,
  ConnectCode as PrismaConnectCode,
  DoctorProfile as PrismaDoctorProfile,
  PatientProfile as PrismaPatientProfile,
  Prescription as PrismaPrescription,
  MedicineSchedule as PrismaMedicineSchedule,
  Notification as PrismaNotification,
  Report as PrismaReport,
  DoctorNote as PrismaDoctorNote,
} from './generated/prisma/client';

type AnyRecord = Record<string, any>;

const modelMap: AnyRecord = {
  Appointment: prisma.appointment,
  Connection: prisma.connection,
  ConnectCode: prisma.connectCode,
  DoctorProfile: prisma.doctorProfile,
  PatientProfile: prisma.patientProfile,
  Prescription: prisma.prescription,
  MedicineSchedule: prisma.medicineSchedule,
  Notification: prisma.notification,
  Report: prisma.report,
  DoctorNote: prisma.doctorNote,
};

const relationMap: AnyRecord = {
  PatientProfile: { user: true },
  DoctorProfile: { user: true },
  Appointment: { patient: { include: { user: true } }, doctor: { include: { user: true } } },
};

function normalizeValue(model: string, key: string, value: any): any {
  if (key === '_id') return value;
  if (model === 'Connection' && key === 'status' && value === 'active') return 'connected';
  if (model === 'Appointment' && key === 'type' && value === 'In-person') return 'In_person';
  if (model === 'MedicineSchedule' && key === 'state' && typeof value === 'string') {
    return value === 'due' ? 'Pending' : value[0].toUpperCase() + value.slice(1);
  }
  return value;
}

function whereFor(model: string, input: AnyRecord = {}): AnyRecord {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (key === '$or') return ['OR', (value as AnyRecord[]).map((item) => whereFor(model, item))];
    if (key === '$and') return ['AND', (value as AnyRecord[]).map((item) => whereFor(model, item))];
    const target = key === '_id' ? 'id' : key;
    if (value instanceof RegExp) return [target, { contains: value.source, mode: 'insensitive' }];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = Object.fromEntries(Object.entries(value).map(([op, v]) => [
        op === '$ne' ? 'not' : op === '$gt' ? 'gt' : op === '$gte' ? 'gte' : op === '$lt' ? 'lt' : op === '$lte' ? 'lte' : op === '$in' ? 'in' : op,
        Array.isArray(v) ? v.map((item) => normalizeValue(model, key, item)) : normalizeValue(model, key, v),
      ]));
      return [target, nested];
    }
    return [target, normalizeValue(model, key, value)];
  }));
}

function expose(model: string, row: any): any {
  if (!row) return row;
  const result: AnyRecord = { ...row, _id: row.id };
  if (model === 'Connection' && result.status === 'connected') result.status = 'active';
  if (model === 'Appointment' && result.type === 'In_person') result.type = 'In-person';
  if (model === 'MedicineSchedule' && result.state === 'Pending') result.state = 'due';
  if (model === 'MedicineSchedule' && ['Taken', 'Missed', 'Snoozed'].includes(result.state)) result.state = result.state.toLowerCase();
  result.save = async () => {
    const { save, ...data } = result;
    const id = data.id;
    delete data._id;
    for (const relation of ['user', 'patient', 'doctor', 'reviewer', 'prescription', 'schedules']) delete data[relation];
    return expose(model, await modelMap[model].update({ where: { id }, data: dataFor(model, data) }));
  };
  return result;
}

function dataFor(model: string, input: AnyRecord): AnyRecord {
  const data = { ...input };
  if (data.$set) Object.assign(data, data.$set);
  delete data.$set;
  delete data._id;
  if (model === 'Connection' && data.status === 'active') data.status = 'connected';
  if (model === 'Appointment' && data.type === 'In-person') data.type = 'In_person';
  if (model === 'MedicineSchedule' && typeof data.state === 'string') {
    data.state = data.state === 'due' ? 'Pending' : data.state[0].toUpperCase() + data.state.slice(1);
  }
  return data;
}

function uniqueWhere(model: string, where: AnyRecord): AnyRecord {
  const normalized = whereFor(model, where);
  if (model === 'Connection' && normalized.patientId && normalized.doctorId) {
    return { patientId_doctorId: { patientId: normalized.patientId, doctorId: normalized.doctorId } };
  }
  return normalized;
}

class PrismaRepository {
  constructor(private readonly model: string) {}
  findOne(where: AnyRecord) {
    return this.query({ where: whereFor(this.model, where), take: 1 });
  }
  findById(id: string) { return this.query({ where: { id } }); }
  find(where: AnyRecord = {}) { return this.query({ where: whereFor(this.model, where) }, true); }
  create(data: AnyRecord) {
    return modelMap[this.model].create({ data: dataFor(this.model, data) }).then((r: any) => expose(this.model, r));
  }
  insertMany(data: AnyRecord[]) {
    return Promise.all(data.map((item) => this.create(item)));
  }
  updateOne(where: AnyRecord, data: AnyRecord) {
    return modelMap[this.model].update({ where: uniqueWhere(this.model, where), data: dataFor(this.model, data) });
  }
  findByIdAndUpdate(id: string, data: AnyRecord) {
    return modelMap[this.model].update({ where: { id }, data: dataFor(this.model, data) }).then((r: any) => expose(this.model, r));
  }
  findOneAndUpdate(where: AnyRecord, data: AnyRecord, options: AnyRecord = {}) {
    const args: AnyRecord = { where: uniqueWhere(this.model, where), update: dataFor(this.model, data), create: dataFor(this.model, { ...where, ...data }) };
    const promise = options.upsert
      ? modelMap[this.model].upsert(args)
      : modelMap[this.model].update(args.update);
    return promise.then((r: any) => expose(this.model, r));
  }
  updateMany(where: AnyRecord, data: AnyRecord) {
    return modelMap[this.model].updateMany({ where: whereFor(this.model, where), data: dataFor(this.model, data) });
  }
  deleteOne(where: AnyRecord) {
    const normalized = whereFor(this.model, where);
    return normalized.id || (this.model === 'Connection' && normalized.patientId && normalized.doctorId)
      ? modelMap[this.model].delete({ where: uniqueWhere(this.model, where) })
      : modelMap[this.model].deleteMany({ where: normalized });
  }
  deleteMany(where: AnyRecord) { return modelMap[this.model].deleteMany({ where: whereFor(this.model, where) }); }
  countDocuments(where: AnyRecord = {}) { return modelMap[this.model].count({ where: whereFor(this.model, where) }); }
  private query(args: AnyRecord, many = false): any {
    const include = relationMap[this.model];
    const promise = many
      ? modelMap[this.model].findMany({ ...args, ...(include ? { include } : {}) })
      : modelMap[this.model].findFirst({ ...args, ...(include ? { include } : {}) });
    const wrapped: AnyRecord = {
      then: (resolve: any, reject?: any) => promise.then((r: any) => resolve(many ? r.map((x: any) => expose(this.model, x)) : expose(this.model, r)), reject),
      sort: (sort: AnyRecord) =>
        this.query(
          {
            ...args,
            orderBy: Object.entries(sort).map(([k, v]) => ({
              [k === '_id' ? 'id' : k]: v === 1 || v === 'asc' ? 'asc' : 'desc',
            })),
          },
          many
        ),
      limit: (n: number) => this.query({ ...args, take: n }, many),
      lean: () => this.query(args, many),
      populate: () => this.query(args, many),
    };
    return wrapped;
  }
}

export const Appointment = new PrismaRepository('Appointment');
export const Connection = new PrismaRepository('Connection');
export const ConnectCode = new PrismaRepository('ConnectCode');
export const DoctorProfile = new PrismaRepository('DoctorProfile');
export const PatientProfile = new PrismaRepository('PatientProfile');
export const Prescription = new PrismaRepository('Prescription');
export const MedicineSchedule = new PrismaRepository('MedicineSchedule');
export const Notification = new PrismaRepository('Notification');
export const Report = new PrismaRepository('Report');
export const DoctorNote = new PrismaRepository('DoctorNote');
type PrismaBacked<T> = Record<string, any> & { __prismaType?: T };
export type IAppointment = PrismaBacked<PrismaAppointment>;
export type IConnection = PrismaBacked<PrismaConnection>;
export type IPatientProfile = PrismaBacked<PrismaPatientProfile>;
export type IDoctorProfile = PrismaBacked<PrismaDoctorProfile>;
export type IPrescription = PrismaBacked<PrismaPrescription>;
export type IMedicineSchedule = PrismaBacked<PrismaMedicineSchedule>;
export type INotification = PrismaBacked<PrismaNotification>;
export type IReport = PrismaBacked<PrismaReport>;
export type IDoctorNote = PrismaBacked<PrismaDoctorNote>;
export type ILabParameter = { status: any; [key: string]: any };
export type AppointmentType = 'In-person' | 'Video_call' | 'Phone_call';
export type AppointmentStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
export type MedicineState = 'taken' | 'due' | 'snoozed' | 'missed';
export type ReportCategory = string;
export type ReportStatus = string;
export type ParameterStatus = string;
export type NotificationType = string;
export type PriorityStateType = string;
