const SUPABASE_URL  = 'https://tsdawpxiqqnesikcqlex.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZGF3cHhpcXFuZXNpa2NxbGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Njk5OTAsImV4cCI6MjA5NjM0NTk5MH0.LfyxBHvg7XCSyjD51MEJq9Ed00-qOG8It5eptOFjZ4s';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth ───────────────────────────────────────────
export const getSession  = ()         => sb.auth.getSession().then(r => r.data.session);
export const signIn      = (em, pw)   => sb.auth.signInWithPassword({ email: em, password: pw });
export const signUp      = (em, pw)   => sb.auth.signUp({ email: em, password: pw });
export const signOut     = ()         => sb.auth.signOut();

// ── Empleadores ────────────────────────────────────
export async function listarEmpleadores() {
  const { data, error } = await sb
    .from('nomina_empleadores')
    .select('id, nombre, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearEmpleador(userId, nombre) {
  const { data, error } = await sb
    .from('nomina_empleadores')
    .insert({ user_id: userId, nombre: nombre || 'Mi hogar', data: {}, firmas: {} })
    .select('id, nombre')
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarEmpleador(id) {
  const { error } = await sb.from('nomina_empleadores').delete().eq('id', id);
  if (error) throw error;
}

// ── Carga inicial (snapshot completo) ─────────────
export async function cargarEmpleador(empleadorId) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Tiempo de espera agotado. Verifica tu conexión.')), 15000)
  );

  const carga = Promise.all([
    sb.from('nomina_empleadores').select('*').eq('id', empleadorId).single(),
    sb.from('nomina_trabajadores').select('id, data').eq('empleador_id', empleadorId),
    sb.from('nomina_boletas')
      .select('id, data, foto_firmada, created_at')
      .eq('empleador_id', empleadorId)
      .order('created_at', { ascending: false }),
  ]);

  const [empR, trabR, bolR] = await Promise.race([carga, timeout]);

  if (empR.error) {
    console.error('[nomina] cargarEmpleador empR error:', empR.error);
    throw new Error(empR.error.message || 'Error al cargar empleador');
  }
  if (trabR.error) console.warn('[nomina] trabajadores error:', trabR.error);
  if (bolR.error)  console.warn('[nomina] boletas error:', bolR.error);

  const emp = empR.data;
  return {
    empleador:    { ...emp.data, nombre: emp.nombre },
    firmas:       emp.firmas || {},
    trabajadores: (trabR.data  || []).map(r => ({ id: r.id, ...r.data })),
    boletas:      (bolR.data || []).map(r => ({
      id: r.id,
      ...r.data,
      fotoFirmada:   r.foto_firmada   ?? r.data?.fotoFirmada   ?? null,
      fotoFirmadaEn: r.data?.fotoFirmadaEn ?? null,
    })),
  };
}

// ── Push helpers (fire-and-forget desde storage.js) ─
export async function sbPushEmpleador(sb, eid, nombreFallback, data, firmas) {
  await sb.from('nomina_empleadores')
    .update({
      nombre:      data.nombre || nombreFallback || 'Mi hogar',
      data,
      firmas,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', eid);
}

export async function sbUpsertTrabajador(sb, eid, uid, trabajador) {
  const { id, ...data } = trabajador;
  await sb.from('nomina_trabajadores')
    .upsert({ id, empleador_id: eid, user_id: uid, data });
}

export async function sbDeleteTrabajador(sb, id) {
  await sb.from('nomina_trabajadores').delete().eq('id', id);
}

export async function sbUpsertBoleta(sb, eid, uid, boleta) {
  const { id, fotoFirmada, ...data } = boleta;
  await sb.from('nomina_boletas')
    .upsert({ id, empleador_id: eid, user_id: uid, data, foto_firmada: fotoFirmada ?? null });
}

export async function sbDeleteBoleta(sb, id) {
  await sb.from('nomina_boletas').delete().eq('id', id);
}
