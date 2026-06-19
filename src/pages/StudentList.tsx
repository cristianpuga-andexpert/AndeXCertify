import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Enrollment, EnrollmentStatus, Course } from '../types';
import { ArrowLeft, UserPlus, FileSpreadsheet, Download, Edit2, Trash2, Search } from 'lucide-react';
import { formatRut, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

export function StudentList() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Enrollment | null>(null);
  const [newStudent, setNewStudent] = useState({
    studentName: '',
    studentRut: '',
    evaluation: '',
    status: EnrollmentStatus.APROBADO,
    attendance: '' as any,
  });

  // Generates and downloads a CSV template matching the "Agregar Alumno" fields.
  // The leading BOM (﻿) makes Excel read accents (RUT/Nombre) correctly.
  const downloadTemplate = () => {
    const headers = ['Nombre', 'RUT', 'Evaluacion', 'Estado', 'Asistencia'];
    const example = ['Juan Perez', '12.345.678-9', '6.5', 'Aprobado', '100'];
    const csv = '﻿' + headers.join(',') + '\n' + example.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-alumnos-${course?.nameReference || 'curso'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadData = () => {
    if (!courseId || !user) return;
    Promise.all([
      api.get<Course>(`/api/courses/${courseId}`),
      api.get<Enrollment[]>(`/api/courses/${courseId}/enrollments`),
    ])
      .then(([c, e]) => { setCourse(c); setStudents(e); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [courseId, user]);

  const handleSaveStudent = async () => {
    if (!courseId || !user) return;
    try {
      if (editingStudent) {
        const updated = await api.put<Enrollment>(`/api/enrollments/${editingStudent.id}`, {
          ...newStudent,
          attendance: newStudent.attendance ? Number(newStudent.attendance) : 0,
        });
        setStudents(prev => prev.map(s => s.id === editingStudent.id ? updated : s));
      } else {
        const created = await api.post<Enrollment>('/api/enrollments', {
          ...newStudent,
          courseId,
          enrollmentDate: new Date().toISOString(),
          attendance: newStudent.attendance ? Number(newStudent.attendance) : 0,
        });
        setStudents(prev => [...prev, created]);
      }
      setIsModalOpen(false);
      setEditingStudent(null);
      setNewStudent({
        studentName: '',
        studentRut: '',
        evaluation: '',
        status: EnrollmentStatus.APROBADO,
        attendance: '' as any,
      });
    } catch (err: any) {
      alert('Error al guardar alumno: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este alumno?')) {
      try {
        await api.del(`/api/enrollments/${id}`);
        setStudents(prev => prev.filter(s => s.id !== id));
      } catch (err: any) {
        alert('Error al eliminar alumno: ' + err.message);
      }
    }
  };

  const openEditModal = (student: Enrollment) => {
    setEditingStudent(student);
    setNewStudent({
      studentName: student.studentName,
      studentRut: student.studentRut,
      evaluation: student.evaluation || '',
      status: student.status,
      attendance: student.attendance !== undefined ? student.attendance : '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-8">
        <div className="flex items-start space-x-6">
          <Link to="/" className="mt-2 h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-all shadow-sm group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-[0.15em] mb-2">
              <Link to="/" className="text-brand hover:underline underline-offset-2 transition-colors">Panel de Cursos</Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-400 max-w-[180px] truncate">{course?.nameReference || '...'}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700">Participantes</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
              {course?.nameReference || 'Cargando...'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium text-xs uppercase tracking-widest opacity-60">Referencia: <span className="font-mono">{courseId?.slice(0, 8)}</span></p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={downloadTemplate} className="btn-secondary flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Descargar Plantilla</span>
          </button>
          <button className="btn-secondary flex items-center space-x-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Importar CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center space-x-2 py-4 shadow-xl shadow-brand/20"
          >
            <UserPlus className="h-4 w-4" />
            <span>Agregar Alumno</span>
          </button>
        </div>
      </div>

      <div className="mb-8 flex justify-between items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en el Registro..."
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none text-sm font-bold shadow-sm"
          />
        </div>
      </div>

      <div className="card-base shadow-2xl shadow-slate-200/50">
        <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-8 py-4">
          <div className="col-span-1 text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none">ID</div>
          <div className="col-span-4 text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none">Nombre Alumno</div>
          <div className="col-span-3 text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none text-center">RUT</div>
          <div className="col-span-2 text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none text-center">Estado</div>
          <div className="col-span-2 text-[10px] uppercase font-black text-slate-400 tracking-widest leading-none text-right">Acciones</div>
        </div>

        <div className="divide-y divide-slate-100 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-20 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent"></div>
              <span className="text-[9px] font-black text-brand uppercase tracking-widest">Escaneando Registro...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center py-20 bg-slate-50/50">
              <div className="h-16 w-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-slate-300 mb-4">
                <UserPlus className="h-8 w-8" />
              </div>
              <p className="text-sm font-black text-slate-500 mb-1">Sin participantes aún</p>
              <p className="text-[10px] font-medium text-slate-400">Agrega el primer alumno con el botón "Agregar Alumno".</p>
            </div>
          ) : (
            students.map((student, idx) => (
              <motion.div
                key={student.id}
                className="grid grid-cols-12 items-center px-8 py-5 group hover:bg-slate-900 transition-all duration-300 cursor-default"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <div className="col-span-1 font-mono text-[11px] text-slate-300 group-hover:text-emerald-500 transition-colors">
                  {(idx + 1).toString().padStart(3, '0')}
                </div>

                <div className="col-span-4">
                  <div className="text-sm font-black text-slate-800 group-hover:text-white transition-colors tracking-tight">
                    {student.studentName}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500 uppercase tracking-widest mt-0.5">
                    Inscripción Verificada
                  </div>
                </div>

                <div className="col-span-3 text-center">
                  <span className="font-mono text-[12px] text-slate-500 group-hover:text-emerald-400 transition-colors tracking-tighter bg-slate-50 group-hover:bg-brand/10 px-3 py-1 rounded-md border border-slate-100 group-hover:border-emerald-900/50">
                    {formatRut(student.studentRut)}
                  </span>
                </div>

                <div className="col-span-2 text-center">
                  <span className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm",
                    student.status === EnrollmentStatus.APROBADO
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:bg-brand group-hover:text-white group-hover:border-brand"
                      : student.status === EnrollmentStatus.RECHAZADO
                        ? "bg-red-50 text-red-700 border-red-100 group-hover:bg-red-900 group-hover:text-red-300 group-hover:border-red-900"
                        : "bg-amber-50 text-amber-700 border-amber-100 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600"
                  )}>
                    {student.status}
                  </span>
                </div>

                <div className="col-span-2 flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-4">
                  <button onClick={() => openEditModal(student)} className="p-2 bg-brand rounded-lg text-white transition-all hover:scale-110 active:scale-90 shadow-lg shadow-brand/20">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(student.id)} className="p-2 bg-red-900 rounded-lg text-white transition-all hover:scale-110 active:scale-90 shadow-lg shadow-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
              onClick={() => { setIsModalOpen(false); setEditingStudent(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateX: 20 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateX: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-white/20"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <div className="text-[10px] font-black text-brand uppercase tracking-[0.3em] mb-2">Crear Alumno</div>
                    <h3 className="text-3xl font-black text-slate-900">
                      {editingStudent ? 'Modificar' : 'Datos del'} <span className="text-brand">Alumno</span>
                    </h3>
                  </div>
                  <button onClick={() => { setIsModalOpen(false); setEditingStudent(null); }} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                    <Trash2 className="h-5 w-5 rotate-45" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nombre Alumno</label>
                    <input
                      type="text"
                      value={newStudent.studentName}
                      onChange={(e) => setNewStudent({ ...newStudent, studentName: e.target.value })}
                      className="input-base text-lg font-black tracking-tight"
                      placeholder="Johnathan Doe Smith"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">RUT</label>
                    <input
                      type="text"
                      value={newStudent.studentRut}
                      onChange={(e) => setNewStudent({ ...newStudent, studentRut: e.target.value })}
                      className="input-base font-mono text-xl tracking-tighter"
                      placeholder="XX.XXX.XXX-X"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Calificación</label>
                      <input
                        type="text"
                        value={newStudent.evaluation}
                        onChange={(e) => setNewStudent({ ...newStudent, evaluation: e.target.value })}
                        className="input-base font-black text-center text-lg"
                        placeholder="6.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Asistencia (%)</label>
                      <input
                        type="number"
                        value={newStudent.attendance}
                        onChange={(e) => setNewStudent({ ...newStudent, attendance: Number(e.target.value) })}
                        className="input-base font-black text-center text-lg"
                        placeholder="100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Estado de Cumplimiento</label>
                    <select
                      value={newStudent.status}
                      onChange={(e) => setNewStudent({ ...newStudent, status: e.target.value as EnrollmentStatus })}
                      className="input-base font-black text-emerald-700 bg-emerald-50/50"
                    >
                      <option value={EnrollmentStatus.APROBADO}>APROBADO</option>
                      <option value={EnrollmentStatus.APROBADO_OBSERVACION}>APROBADO CON OBSERVACIÓN</option>
                      <option value={EnrollmentStatus.RECHAZADO}>RECHAZADO</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-10 py-8 flex justify-end space-x-4 border-t border-slate-100">
                <button
                  onClick={() => { setIsModalOpen(false); setEditingStudent(null); }}
                  className="text-slate-400 font-bold hover:text-red-500 transition-colors uppercase tracking-[0.2em] text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveStudent}
                  disabled={!newStudent.studentName || !newStudent.studentRut}
                  className="btn-primary py-4 px-10 shadow-xl shadow-brand/20 disabled:opacity-20"
                >
                  {editingStudent ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
