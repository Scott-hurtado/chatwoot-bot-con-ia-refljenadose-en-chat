import mysql from 'mysql2/promise';
import type { 
  Vacante, 
  CreateVacanteInput, 
  VacanteFilters
} from './types';

class VacantesDatabase {
  private connection: mysql.Connection | null = null;

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'yop',
        port: parseInt(process.env.DB_PORT || '3306')
      });
      
      console.log('✅ Conexión a MySQL establecida');
      
      // Crear tabla si no existe
      await this.createTableIfNotExists();
      
    } catch (error) {
      console.error('❌ Error al conectar con MySQL:', error);
      throw error;
    }
  }

  private async createTableIfNotExists() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS vacantes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        empresa VARCHAR(255) NOT NULL,
        nombre_vacante VARCHAR(255) NOT NULL,
        modalidad ENUM('tiempo_completo', 'medio_tiempo', 'remoto', 'hibrido', 'presencial') NOT NULL,
        cantidad_reclutar INT NOT NULL DEFAULT 1,
        lugar VARCHAR(100) NOT NULL,
        link_url VARCHAR(500),
        carrera VARCHAR(255) NOT NULL,
        tipo_vacante ENUM('servicio_social', 'practicas_profesionales', 'ambos') NOT NULL DEFAULT 'ambos',
        descripcion TEXT,
        requisitos TEXT,
        beneficios TEXT,
        fecha_publicacion DATE,
        fecha_limite DATE,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_carrera (carrera),
        INDEX idx_modalidad (modalidad),
        INDEX idx_lugar (lugar),
        INDEX idx_activa (activa)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    try {
      await this.connection?.execute(createTableQuery);
      console.log('✅ Tabla "vacantes" verificada/creada');
    } catch (error) {
      console.error('❌ Error al crear tabla:', error);
    }
  }

  // Obtener vacantes por carrera
  async getVacantesByCarrera(carrera: string): Promise<Vacante[]> {
    try {
      const [rows] = await this.connection?.execute(
        'SELECT * FROM vacantes WHERE carrera LIKE ? AND activa = TRUE ORDER BY COALESCE(fecha_publicacion, created_at) DESC',
        [`%${carrera}%`]
      ) || [[]];
      return rows as Vacante[];
    } catch (error) {
      console.error('Error al buscar vacantes por carrera:', error);
      return [];
    }
  }

  // Obtener vacantes con filtros múltiples
  async getVacantesWithFilters(filters: VacanteFilters): Promise<Vacante[]> {
    try {
      let query = 'SELECT * FROM vacantes WHERE activa = TRUE';
      const params: any[] = [];

      if (filters.carrera) {
        query += ' AND carrera LIKE ?';
        params.push(`%${filters.carrera}%`);
      }

      if (filters.modalidad) {
        query += ' AND modalidad = ?';
        params.push(filters.modalidad);
      }

      if (filters.lugar) {
        query += ' AND lugar LIKE ?';
        params.push(`%${filters.lugar}%`);
      }

      if (filters.tipo_vacante) {
        query += ' AND (tipo_vacante = ? OR tipo_vacante = "ambos")';
        params.push(filters.tipo_vacante);
      }

      if (filters.empresa) {
        query += ' AND empresa LIKE ?';
        params.push(`%${filters.empresa}%`);
      }

      query += ' ORDER BY COALESCE(fecha_publicacion, created_at) DESC';

      const [rows] = await this.connection?.execute(query, params) || [[]];
      return rows as Vacante[];
    } catch (error) {
      console.error('Error al buscar vacantes con filtros:', error);
      return [];
    }
  }

  // Obtener todas las vacantes activas
  async getAllVacantes(): Promise<Vacante[]> {
    try {
      const [rows] = await this.connection?.execute(
        'SELECT * FROM vacantes WHERE activa = TRUE ORDER BY COALESCE(fecha_publicacion, created_at) DESC LIMIT 20'
      ) || [[]];
      return rows as Vacante[];
    } catch (error) {
      console.error('Error al obtener vacantes:', error);
      return [];
    }
  }

  // Obtener carreras disponibles
  async getCarrerasDisponibles(): Promise<string[]> {
    try {
      const [rows] = await this.connection?.execute(
        'SELECT DISTINCT carrera FROM vacantes WHERE activa = TRUE ORDER BY carrera'
      ) || [[]];
      return (rows as any[]).map(row => row.carrera);
    } catch (error) {
      console.error('Error al obtener carreras:', error);
      return [];
    }
  }

  // Obtener lugares disponibles
  async getLugaresDisponibles(): Promise<string[]> {
    try {
      const [rows] = await this.connection?.execute(
        'SELECT DISTINCT lugar FROM vacantes WHERE activa = TRUE ORDER BY lugar'
      ) || [[]];
      return (rows as any[]).map(row => row.lugar);
    } catch (error) {
      console.error('Error al obtener lugares:', error);
      return [];
    }
  }

  // Agregar nueva vacante
  async addVacante(vacante: CreateVacanteInput): Promise<boolean> {
    try {
      const [result] = await this.connection?.execute(
        `INSERT INTO vacantes (empresa, nombre_vacante, modalidad, cantidad_reclutar, 
         lugar, link_url, carrera, tipo_vacante, descripcion, requisitos, beneficios, fecha_publicacion, fecha_limite) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
        [
          vacante.empresa,
          vacante.nombre_vacante,
          vacante.modalidad,
          vacante.cantidad_reclutar,
          vacante.lugar,
          vacante.link_url,
          vacante.carrera,
          vacante.tipo_vacante,
          vacante.descripcion,
          vacante.requisitos,
          vacante.beneficios,
          vacante.fecha_limite
        ]
      ) || [null];
      
      return !!(result as any)?.insertId;
    } catch (error) {
      console.error('Error al agregar vacante:', error);
      return false;
    }
  }

  // Formatear información de vacante para mostrar
  formatVacanteInfo(vacante: Vacante): string {
    const modalidadLabel = {
      'tiempo_completo': 'Tiempo Completo',
      'medio_tiempo': 'Medio Tiempo',
      'remoto': 'Remoto',
      'hibrido': 'Híbrido',
      'presencial': 'Presencial'
    }[vacante.modalidad];

    const tipoLabel = {
      'servicio_social': 'Servicio Social',
      'practicas_profesionales': 'Prácticas Profesionales',
      'ambos': 'Servicio Social y Prácticas'
    }[vacante.tipo_vacante];

    let info = `
🏢 *${vacante.empresa}*
📋 *Puesto:* ${vacante.nombre_vacante}
🎓 *Carrera:* ${vacante.carrera}
📍 *Lugar:* ${vacante.lugar}
⏰ *Modalidad:* ${modalidadLabel}
👥 *Vacantes:* ${vacante.cantidad_reclutar}
📝 *Tipo:* ${tipoLabel}`;

    if (vacante.descripcion) {
      info += `\n💼 *Descripción:* ${vacante.descripcion}`;
    }

    if (vacante.requisitos) {
      info += `\n✅ *Requisitos:* ${vacante.requisitos}`;
    }

    if (vacante.beneficios) {
      info += `\n🎁 *Beneficios:* ${vacante.beneficios}`;
    }

    if (vacante.link_url) {
      info += `\n🔗 *Más info:* ${vacante.link_url}`;
    }

    if (vacante.fecha_limite) {
      const fechaLimite = new Date(vacante.fecha_limite).toLocaleDateString('es-MX');
      info += `\n⏳ *Fecha límite:* ${fechaLimite}`;
    }

    return info.trim();
  }

  // Formatear lista resumida de vacantes
  formatVacanteResumen(vacante: Vacante): string {
    const modalidadLabel = {
      'tiempo_completo': '⏰',
      'medio_tiempo': '⏱️',
      'remoto': '🏠',
      'hibrido': '🔄',
      'presencial': '🏢'
    }[vacante.modalidad];

    return `${modalidadLabel} *${vacante.nombre_vacante}* en ${vacante.empresa} - ${vacante.lugar}`;
  }

  // Obtener estadísticas
  async getEstadisticas(): Promise<any> {
    try {
      const [totalVacantes] = await this.connection?.execute(
        'SELECT COUNT(*) as total FROM vacantes WHERE activa = TRUE'
      ) || [[]];

      const [porCarrera] = await this.connection?.execute(
        'SELECT carrera, COUNT(*) as total FROM vacantes WHERE activa = TRUE GROUP BY carrera ORDER BY total DESC LIMIT 5'
      ) || [[]];

      const [porLugar] = await this.connection?.execute(
        'SELECT lugar, COUNT(*) as total FROM vacantes WHERE activa = TRUE GROUP BY lugar ORDER BY total DESC LIMIT 5'
      ) || [[]];

      return {
        total: (totalVacantes as any)[0]?.total || 0,
        porCarrera: porCarrera as any[],
        porLugar: porLugar as any[]
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return { total: 0, porCarrera: [], porLugar: [] };
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      console.log('🔌 Conexión a MySQL cerrada');
    }
  }
}

export default new VacantesDatabase();