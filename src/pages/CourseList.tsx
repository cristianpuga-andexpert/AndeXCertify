import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Course, CourseStatus } from '../types';
import { Plus, List, Grid, Edit2, Trash2, Users, FileText, Search, BookOpen, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import { LoginView } from '../components/LoginView';

export function CourseList() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const path = 'courses';
    const q = query(collection(db, path), where('createdBy', '==', user.uid));
    
    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(docs);
      setLoading(false);
    }, (error) => {
      if (!auth.currentUser && error.message.includes('permission')) {
        return;
      }
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este curso?')) {
      const path = `courses/${id}`;
      try {
        await deleteDoc(doc(db, 'courses', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
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
          <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">No hay Cursos Activos</h3>
          <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">Su repositorio de cursos está vacío. Inicialice uno nuevo para comenzar a emitir certificados.</p>
          <Link to="/courses/new" className="mt-8 inline-block btn-secondary">Comenzar</Link>
        </div>
      ) : (
        <div className="card-base shadow-2xl shadow-slate-200/50">
          {/* Header row - Systematic feel */}
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-4">
            <div className="col-span-1 text-[10px] uppercase font-black text-slate-400 tracking-widest">ID</div>
            <div className="col-span-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">Entidad del Curso</div>
            <div className="col-span-3 text-[10px] uppercase font-black text-slate-400 tracking-widest">Referencia / Enlace</div>
            <div className="col-span-2 text-[10px] uppercase font-black text-slate-400 tracking-widest">Fecha de Integridad</div>
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
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full shadow-sm",
                      course.isSence ? "bg-amber-400" : "bg-indigo-400"
                    )}></div>
                    <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-300 transition-colors">
                      {course.isSence ? `SENCE_REF: ${course.senceData?.empresa.slice(0, 15)}...` : 'LOCAL_AUTH'}
                    </span>
                  </div>
                </div>
                
                <div className="col-span-2 font-mono text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors">
                  {course.createdAt ? format(new Date(course.createdAt), 'dd/MM/yyyy') : '00/00/0000'}
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
                    onClick={() => handleDelete(course.id)}
                    className="p-2 bg-slate-50 group-hover:bg-red-900 rounded-lg text-slate-300 group-hover:text-red-400 transition-all hover:scale-110 active:scale-95 shadow-sm ml-4"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
