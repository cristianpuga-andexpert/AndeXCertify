export enum CourseType {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}

export enum CourseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum QRDestination {
  PDF = 'pdf',
  VERIFICATION = 'verification',
}

export interface SenceData {
  empresa: string;
  rutEmpresa: string;
  nombreCurso: string;
  codigoSence: string;
  fecInicio: string;
  fecTermino: string;
  fecVencimiento: string;
  horasActividad: number;
  fecEmision: string;
}

export interface Course {
  id: string;
  nameReference: string;
  nameVisible: string;
  type: CourseType;
  expirationDate?: string;
  qrDestination: QRDestination;
  status: CourseStatus;
  isSence: boolean;
  senceData?: SenceData;
  templateId?: string;
  customAssetUrl?: string;
  description?: string;
  createdAt: string;
  createdBy: string;
}

export enum EnrollmentStatus {
  APROBADO = 'Aprobado',
  APROBADO_OBSERVACION = 'Aprobado con observación',
  RECHAZADO = 'Rechazado',
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentName: string;
  studentRut: string;
  enrollmentDate: string;
  evaluation?: string;
  status: EnrollmentStatus;
  attendance?: number;
  certificateGeneratedAt?: string;
}

export interface OrganizationSettings {
  name: string;
  rut: string;
  lema?: string;
  useCustomStamp?: boolean;
  customStampName?: string;
  stampStyle?: 'circular_double' | 'circular_horizontal' | 'circular_dots' | 'oval' | 'square';
  logoUrl?: string;
  updatedAt: string;
}

export interface Representative {
  id: string;
  name: string;
  rut: string;
  signatureUrl: string;
  createdAt: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  type: 'sence' | 'non-sence';
  fileData: string; // Base64 Word file
  fileName: string;
  isCompressed?: boolean;
  createdAt: string;
  createdBy: string;
}
