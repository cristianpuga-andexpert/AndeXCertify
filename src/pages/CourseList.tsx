import React, { useEffect, useState } from 'react';
import { Course, CourseStatus } from '../types';
import { Plus, List, Grid, Edit2, Trash2, Users, FileText, Search, BookOpen, Award, AlertTriangle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { LoginView } from '../components/LoginView';
import { api } from '../lib/api';

export function CourseList() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      api.get<Course[]>('/api/courses'),
      api.get<Record<string, number>>('/api/enrollment-counts'),
    ])
      .then(([courseList, counts]) => {
        setCourses(courseList);
        setEnrollmentCounts(counts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del('/api/courses/' + deleteTarget.id);
      setCourses(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert('Error al eliminar el curso: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold text-brand uppercase tracking-[0.2em] mb-2">
            <div className="h-1 w-1 rounded-full bg-brand animate-pulse"></div>
            <span>Consola del Sistema</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
            Panel de <span className="text-brand">Emisor</span>
          </h1>
          <p className="text-slate-500 mt-4 max-w-md text-sm leading-relaxed">
            Gestione sus cursos y credenciales emitidas con precisión.
            Todos los certificados están vinculados criptográficamente a su ID de emisor.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/courses/new"
            className="btn-primary flex items-center space-x-2 shadow-xl shadow-brand/20 py-4 px-8"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Curso</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent"></div>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Leyendo Registro...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <BookOpen className="mx-auto h-16 w-16 text-slate-300 mb-6" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No tienes cursos todavía</h3>
          <p className="text-slate-500 max-w-xs mx-auto text-sm">Crea tu primer curso y comienza a emitir certificados para tus participantes.</p>
          <Link to="/courses/new" className="mt-8 inline-block btn-primary">Crear primer curso</Link>
        </div>
      ) : (
        <div className="card-base shadow-2xl shadow-slate-200/50">
          {/* Header row - Systematic feel */}
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-4">
            <div className="col-span-1 text-[10px] uppercase font-black text-slate-400 tracking-widest">ID</div>
            <div className="col-span-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">Nombre del Curso</div>
            <div className="col-span-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">Participantes</div>
            <div className="col-span-2 text-[10px] uppercase font-black text-slate-400 tracking-widest">Fecha Vencimiento</div>
            <div className="col-span-2 text-[10px] uppercase font-black text-slate-400 tracking-widest text-right">Acciones</div>
          </div>

          <div className="divide-y divide-slate-100">
            {courses.map((course, idx) => (
              <motion.div
                key={course.id}
                layoutId={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="grid grid-cols-12 items-center px-6 py-5 group hover:bg-slate-900 transition-all duration-300 cursor-default"
              >
                <div className="col-span-1 font-mono text-[11px] text-slate-400 group-hover:text-brand transition-colors">
                  {(idx + 1).toString().padStart(2, '0')}
                </div>

                <div className="col-span-4">
                  <div className="text-sm font-black text-slate-900 group-hover:text-white transition-colors tracking-tight">
                    {course.nameReference}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 group-hover:text-slate-400 uppercase tracking-widest mt-1">
                    {course.nameVisible}
                  </div>
                </div>

                <div className="col-span-3">
                  <div className="flex items-center space-x-2">
                    <Users className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand transition-colors shrink-0" />
                    <span className="text-[13px] font-black text-slate-700 group-hover:text-white transition-colors">
                      {enrollmentCounts[course.id] ?? 0}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-400 transition-colors">
                      {(enrollmentCounts[course.id] ?? 0) === 1 ? 'persona' : 'personas'}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 font-mono text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors">
                  {course.expirationDate
                    ? format(new Date(course.expirationDate), 'dd/MM/yyyy')
                    : <span className="text-slate-300 group-hover:text-slate-600">Sin vencimiento</span>}
                </div>

                <div className="col-span-2 flex justify-end space-x-1 opacity-100">
                  <Link
                    to={`/courses/${course.id}/students`}
                    className="p-2 bg-slate-100 group-hover:bg-brand rounded-lg text-slate-400 group-hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"
                    title="Alumnos"
                  >
                    <Users className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/courses/${course.id}/certificates`}
                    className="p-2 bg-slate-100 group-hover:bg-brand rounded-lg text-slate-400 group-hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"
                    title="Certificados"
                  >
                    <FileText className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/courses/edit/${course.id}`}
                    className="p-2 bg-slate-100 group-hover:bg-brand rounded-lg text-slate-400 group-hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"
                    title="Configuración"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget({ id: course.id, name: course.nameReference || course.nameVisible })}
                    className="p-2 bg-slate-50 group-hover:bg-red-900 rounded-lg text-slate-300 group-hover:text-red-400 transition-all hover:scale-110 active:scale-95 shadow-sm ml-4"
                    title="Eliminar curso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Eliminar Curso</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar el curso{' '}
                <span className="font-black text-slate-900">"{deleteTarget.name}"</span>?
                Se eliminarán también todos los alumnos y certificados asociados.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn-secondary px-5 py-2.5"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center space-x-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
              >
                {deleting ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>{deleting ? 'Eliminando...' : 'Sí, eliminar'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
