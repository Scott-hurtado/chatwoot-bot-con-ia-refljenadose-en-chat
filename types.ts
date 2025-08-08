// Tipos para la aplicación de vacantes

export type Modalidad = 'tiempo_completo' | 'medio_tiempo' | 'remoto' | 'hibrido' | 'presencial';
export type TipoVacante = 'servicio_social' | 'practicas_profesionales' | 'ambos';

export interface Vacante {
  id: number;
  empresa: string;
  nombre_vacante: string;
  modalidad: Modalidad;
  cantidad_reclutar: number;
  lugar: string;
  link_url?: string | null;
  carrera: string;
  tipo_vacante: TipoVacante;
  descripcion?: string | null;
  requisitos?: string | null;
  beneficios?: string | null;
  fecha_publicacion?: Date;
  fecha_limite?: Date | null;
  activa?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateVacanteInput {
  empresa: string;
  nombre_vacante: string;
  modalidad: Modalidad;
  cantidad_reclutar: number;
  lugar: string;
  link_url?: string | null;
  carrera: string;
  tipo_vacante: TipoVacante;
  descripcion?: string | null;
  requisitos?: string | null;
  beneficios?: string | null;
  fecha_limite?: Date | null;
}

export interface VacanteFilters {
  carrera?: string;
  modalidad?: Modalidad;
  lugar?: string;
  tipo_vacante?: TipoVacante;
  empresa?: string;
  activa?: boolean;
}

export interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

export interface BotConfig {
  jwtToken: string;
  numberId: string;
  verifyToken: string;
  version: string;
}

// Enum para las carreras más comunes (expandible)
export const CARRERAS_COMUNES = [
  'Ingeniería en Sistemas',
  'Ingeniería en Software',
  'Ingeniería Industrial',
  'Administración de Empresas',
  'Contaduría Pública',
  'Derecho',
  'Psicología',
  'Diseño Gráfico',
  'Mercadotecnia',
  'Marketing Digital',
  'Ciencias de la Comunicación',
  'Recursos Humanos',
  'Arquitectura',
  'Medicina',
  'Enfermería',
  'Nutrición',
  'Ingeniería Civil',
  'Ingeniería Mecánica',
  'Ingeniería Electrónica',
  'Comercio Internacional',
  'Relaciones Internacionales',
  'Economía',
  'Finanzas'
];

// Lugares comunes
export const LUGARES_COMUNES = [
  'Hermosillo',
  'CDMX',
  'Guadalajara',
  'Monterrey',
  'Puebla',
  'Querétaro',
  'Tijuana',
  'León',
  'Mérida',
  'Cancún',
  'Remoto'
];

// Mapeo de modalidades para mostrar al usuario
export const MODALIDAD_LABELS: Record<Modalidad, string> = {
  'tiempo_completo': 'Tiempo Completo',
  'medio_tiempo': 'Medio Tiempo',
  'remoto': 'Remoto',
  'hibrido': 'Híbrido',
  'presencial': 'Presencial'
};

// Mapeo de tipos de vacante
export const TIPO_VACANTE_LABELS: Record<TipoVacante, string> = {
  'servicio_social': 'Servicio Social',
  'practicas_profesionales': 'Prácticas Profesionales',
  'ambos': 'Servicio Social y Prácticas'
}; 