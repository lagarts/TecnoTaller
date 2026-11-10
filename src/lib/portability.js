// ============================================================
// Portabilidad de datos — TecnoTaller
// Exportar / importar respaldos en JSON.
// Los archivos NUNCA incluyen contraseñas ni tokens:
// el cliente se registra de nuevo con su DNI y después
// importa su archivo para recuperar vehículos e historial.
// ============================================================

export const CLIENT_FILE_TYPE = 'tecnotaller-client';
export const PORTAL_FILE_TYPE = 'tecnotaller-portal';

const clean = (s) => (s ?? '').toString().trim();
const lower = (s) => clean(s).toLowerCase();
const APPT_STATUSES = ['pendiente', 'confirmado', 'cancelado', 'completado'];

// ------------------------------------------------------------
// Utilidades de archivo
// ------------------------------------------------------------
export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}

export function parsePortabilityFile(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { error: 'El archivo no es un JSON válido.' }; }
  if (!raw || typeof raw !== 'object') return { error: 'Archivo inválido.' };
  if (raw.type !== CLIENT_FILE_TYPE && raw.type !== PORTAL_FILE_TYPE) {
    return { error: 'Este archivo no es un respaldo de TecnoTaller.' };
  }
  return { file: raw };
}

// Contenido del archivo para mostrar antes de importar
export function fileSummary(file) {
  if (!file) return { clients: 0, vehicles: 0, records: 0, appointments: 0 };
  if (file.type === CLIENT_FILE_TYPE) {
    const vehicles = file.vehicles || [];
    return {
      clients: 1,
      vehicles: vehicles.length,
      records: vehicles.reduce((n, v) => n + ((v.records || []).length), 0),
      appointments: 0,
    };
  }
  const d = file.data || {};
  return {
    clients: (d.clients || []).length,
    vehicles: (d.vehicles || []).length,
    records: (d.records || []).length,
    appointments: (d.appointments || []).length,
  };
}

// ------------------------------------------------------------
// 1. CLIENTE: exportar sus datos (vehículos + historial)
// ------------------------------------------------------------
export function buildClientPayload(profile, vehicles, records) {
  const byVehicle = new Map();
  (records || []).forEach((r) => {
    if (!byVehicle.has(r.vehicle_id)) byVehicle.set(r.vehicle_id, []);
    byVehicle.get(r.vehicle_id).push(r);
  });

  return {
    app: 'TecnoTaller',
    type: CLIENT_FILE_TYPE,
    version: 1,
    exported_at: new Date().toISOString(),
    client: {
      dni: profile?.dni || '',
      name: profile?.name || '',
      phone: profile?.phone || '',
    },
    vehicles: (vehicles || []).map((v) => ({
      patente: v.patente,
      brand: v.brand || '',
      model: v.model || '',
      year: v.year ?? null,
      color: v.color || '',
      km: v.km ?? 0,
      notes: v.notes || '',
      records: (byVehicle.get(v.id) || []).map((r) => ({
        origin: r.origin,
        service_date: r.service_date,
        km: r.km,
        description: r.description,
        price: r.price,
        notes: r.notes || '',
      })),
    })),
  };
}

// ------------------------------------------------------------
// 2. CLIENTE: importar sus datos en su propia cuenta
// ------------------------------------------------------------
export async function importClientPayload(file, { client, profile }) {
  const summary = {
    vehiculos: 0, vehiculosExistentes: 0, vehiculosOmitidos: 0,
    servicios: 0, serviciosDuplicados: 0, serviciosOmitidos: 0,
    avisos: [],
  };
  if (file?.type !== CLIENT_FILE_TYPE) return { error: 'Este archivo no es un respaldo de cliente.' };
  if (!profile?.id) return { error: 'No se pudo identificar tu cuenta.' };

  const [{ data: myVehicles, error: vErr }, { data: myRecords, error: rErr }] = await Promise.all([
    client.from('portal_vehicles').select('*'),
    client.from('service_records').select('*'),
  ]);
  if (vErr || rErr) return { error: 'No se pudieron leer tus datos: ' + (vErr || rErr).message };

  const byPatente = new Map((myVehicles || []).map((v) => [clean(v.patente).toUpperCase(), v]));
  const recordsByVehicle = new Map();
  (myRecords || []).forEach((r) => {
    if (!recordsByVehicle.has(r.vehicle_id)) recordsByVehicle.set(r.vehicle_id, []);
    recordsByVehicle.get(r.vehicle_id).push(r);
  });

  const recKey = (r) => `${clean(r.service_date)}|${lower(r.description)}|${clean(r.origin)}`;
  let usedExternalFallback = false;

  for (const v of file.vehicles || []) {
    const patente = clean(v.patente).toUpperCase();
    if (!patente) {
      summary.vehiculosOmitidos++;
      summary.avisos.push('Un vehículo sin patente fue omitido.');
      continue;
    }

    let vehicle = byPatente.get(patente);
    if (vehicle) {
      summary.vehiculosExistentes++;
    } else {
      const { data: ins, error } = await client.from('portal_vehicles').insert({
        client_id: profile.id,
        patente,
        brand: clean(v.brand),
        model: clean(v.model),
        year: v.year ? Number(v.year) : null,
        color: clean(v.color),
        km: v.km ? Number(v.km) : 0,
        notes: clean(v.notes),
      }).select('id').single();

      if (error) {
        summary.vehiculosOmitidos++;
        if (error.code === '23505') {
          summary.avisos.push(`La patente ${patente} ya está registrada a nombre de otro cliente: se omitió.`);
        } else {
          summary.avisos.push(`No se pudo importar ${patente}: ${error.message}`);
        }
        continue;
      }
      vehicle = { id: ins.id, patente };
      byPatente.set(patente, vehicle);
      summary.vehiculos++;
    }

    // Servicios del vehículo
    const existing = recordsByVehicle.get(vehicle.id) || [];
    const seen = new Set(existing.map(recKey));

    for (const r of v.records || []) {
      if (!r?.service_date || !clean(r.description)) { summary.serviciosOmitidos++; continue; }
      const origin = r.origin === 'externo' ? 'externo' : 'taller';
      const key = `${clean(r.service_date)}|${lower(r.description)}|${origin}`;
      if (seen.has(key)) { summary.serviciosDuplicados++; continue; }

      const payload = {
        vehicle_id: vehicle.id,
        origin,
        service_date: r.service_date,
        km: r.km != null && r.km !== '' ? Number(r.km) : null,
        description: clean(r.description),
        price: r.price != null && r.price !== '' ? Number(r.price) : 0,
        notes: clean(r.notes),
        created_by: profile.id,
      };

      let { data: inserted, error } = await client.from('service_records').insert(payload).select('id');

      if ((error || !inserted || inserted.length === 0) && origin === 'taller') {
        // Un cliente no puede crear registros "del taller": se importan
        // como servicio externo para no perder el dato.
        usedExternalFallback = true;
        ({ data: inserted, error } = await client
          .from('service_records')
          .insert({ ...payload, origin: 'externo' })
          .select('id'));
      }

      if (error || !inserted || inserted.length === 0) {
        summary.serviciosOmitidos++;
        if (error) summary.avisos.push(`No se pudo importar "${clean(r.description)}": ${error.message}`);
        continue;
      }
      seen.add(key);
      summary.servicios++;
    }
  }

  if (usedExternalFallback) {
    summary.avisos.push('Los trabajos que hacían los talleres anteriores quedaron guardados como servicios externos (solo el taller nuevo podrá cargar los suyos).');
  }
  if (summary.vehiculosOmitidos === 0 && summary.serviciosOmitidos === 0 && summary.avisos.length === 0) {
    summary.avisos.push('Todo se importó correctamente.');
  }
  return summary;
}

// ------------------------------------------------------------
// 3. ADMIN: exportar todo el portal
// ------------------------------------------------------------
export function buildPortalPayload({ clients, vehicles, records, appointments }) {
  return {
    app: 'TecnoTaller',
    type: PORTAL_FILE_TYPE,
    version: 1,
    exported_at: new Date().toISOString(),
    note: 'Respaldo completo del portal de turnos. No incluye contraseñas.',
    data: {
      clients: clients || [],
      vehicles: vehicles || [],
      records: records || [],
      appointments: appointments || [],
    },
  };
}

// ------------------------------------------------------------
// 4. ADMIN: importar respaldo del portal (o un archivo de cliente)
//    Los clientes se emparejan por DNI: los que todavía no tienen
//    cuenta quedan como "pendientes" y se importan en una segunda
//    pasada cuando se registren (el proceso no duplica datos).
// ------------------------------------------------------------
export async function importPortalPayload(file, { client }) {
  const summary = {
    clientes: 0, clientesPendientes: [],
    vehiculos: 0, vehiculosExistentes: 0, vehiculosOmitidos: 0,
    servicios: 0, serviciosDuplicados: 0, serviciosOmitidos: 0,
    turnos: 0, turnosOmitidos: 0,
    avisos: [],
  };

  // ---- Normalizar a una estructura común ----
  let srcClients, srcVehicles, srcRecords, srcAppts;
  if (file?.type === PORTAL_FILE_TYPE) {
    const d = file.data || {};
    srcClients = d.clients || [];
    srcVehicles = d.vehicles || [];
    srcRecords = d.records || [];
    srcAppts = d.appointments || [];
  } else if (file?.type === CLIENT_FILE_TYPE) {
    srcClients = [{ id: '__self__', dni: file.client?.dni, name: file.client?.name, phone: file.client?.phone }];
    srcVehicles = (file.vehicles || []).map((v) => ({ ...v, id: `veh-${v.patente}`, client_id: '__self__' }));
    srcRecords = [];
    (file.vehicles || []).forEach((v) => {
      (v.records || []).forEach((r) => srcRecords.push({ ...r, __patente: v.patente }));
    });
    srcAppts = [];
  } else {
    return { error: 'Archivo no reconocido.' };
  }

  const fileClientById = new Map(srcClients.map((c) => [c.id, c]));
  const fileVehicleById = new Map(srcVehicles.map((v) => [v.id, v]));
  const dniOf = (clientId) => clean(fileClientById.get(clientId)?.dni);
  const patenteOf = (vehicleId) => clean(fileVehicleById.get(vehicleId)?.patente).toUpperCase();

  srcRecords = srcRecords.map((r) => ({
    ...r,
    __patente: clean(r.__patente || patenteOf(r.vehicle_id)).toUpperCase(),
  }));

  // ---- Resolver clientes por DNI en la BD ----
  const { data: dbClients, error: cErr } = await client.from('portal_clients').select('id, dni, name, phone');
  if (cErr) return { error: 'No se pudieron leer los clientes: ' + cErr.message };

  const dbByDni = new Map((dbClients || []).map((c) => [clean(c.dni), c]));
  const dbIdByDni = new Map();
  const pending = new Map();
  srcClients.forEach((c) => {
    const dni = clean(c.dni);
    if (!dni) return;
    const db = dbByDni.get(dni);
    if (db) {
      if (!dbIdByDni.has(dni)) summary.clientes++;
      dbIdByDni.set(dni, db.id);
    } else if (!pending.has(dni)) {
      pending.set(dni, clean(c.name));
    }
  });
  summary.clientesPendientes = [...pending.entries()].map(([dni, name]) => ({ dni, name }));

  // ---- Vehículos ----
  const { data: dbVehicles } = await client.from('portal_vehicles').select('id, patente, client_id');
  const dbVehByPatente = new Map((dbVehicles || []).map((v) => [clean(v.patente).toUpperCase(), v]));
  const vidByPatente = new Map();
  const ownerDniByPatente = new Map();

  for (const v of srcVehicles) {
    const patente = clean(v.patente).toUpperCase();
    const dni = dniOf(v.client_id);
    if (!patente) { summary.vehiculosOmitidos++; continue; }

    const dbClientId = dbIdByDni.get(dni);
    if (!dbClientId) {
      summary.vehiculosOmitidos++;
      continue; // dueño pendiente de registro
    }

    const existing = dbVehByPatente.get(patente);
    if (existing) {
      if (existing.client_id === dbClientId) {
        vidByPatente.set(patente, existing.id);
        ownerDniByPatente.set(patente, dni);
        summary.vehiculosExistentes++;
      } else {
        summary.vehiculosOmitidos++;
        summary.avisos.push(`Patente ${patente}: ya está registrada a nombre de otro cliente, se omitió.`);
      }
      continue;
    }

    const { data: ins, error } = await client.from('portal_vehicles').insert({
      client_id: dbClientId,
      patente,
      brand: clean(v.brand),
      model: clean(v.model),
      year: v.year ? Number(v.year) : null,
      color: clean(v.color),
      km: v.km ? Number(v.km) : 0,
      notes: clean(v.notes),
    }).select('id').single();

    if (error) {
      summary.vehiculosOmitidos++;
      summary.avisos.push(`No se pudo importar ${patente}: ${error.message}`);
      continue;
    }
    vidByPatente.set(patente, ins.id);
    ownerDniByPatente.set(patente, dni);
    dbVehByPatente.set(patente, { id: ins.id, patente, client_id: dbClientId });
    summary.vehiculos++;
  }

  // ---- Historial de servicios ----
  const { data: dbRecords } = await client
    .from('service_records')
    .select('vehicle_id, service_date, description, origin');
  const recKeys = new Set(
    (dbRecords || []).map((r) => `${r.vehicle_id}|${clean(r.service_date)}|${lower(r.description)}|${clean(r.origin)}`)
  );

  for (const r of srcRecords) {
    const vid = vidByPatente.get(clean(r.__patente).toUpperCase());
    if (!vid || !r.service_date || !clean(r.description)) { summary.serviciosOmitidos++; continue; }

    const origin = r.origin === 'externo' ? 'externo' : 'taller';
    const key = `${vid}|${clean(r.service_date)}|${lower(r.description)}|${origin}`;
    if (recKeys.has(key)) { summary.serviciosDuplicados++; continue; }

    const ownerDni = ownerDniByPatente.get(clean(r.__patente).toUpperCase());
    const { error } = await client.from('service_records').insert({
      vehicle_id: vid,
      origin,
      service_date: r.service_date,
      km: r.km != null && r.km !== '' ? Number(r.km) : null,
      description: clean(r.description),
      price: r.price != null && r.price !== '' ? Number(r.price) : 0,
      notes: clean(r.notes),
      created_by: dbIdByDni.get(ownerDni) || null,
    });

    if (error) { summary.serviciosOmitidos++; continue; }
    recKeys.add(key);
    summary.servicios++;
  }

  // ---- Turnos ----
  if (srcAppts.length > 0) {
    const dates = [...new Set(srcAppts.map((a) => clean(a.appt_date)).filter(Boolean))];
    const { data: dbAppts } = await client
      .from('appointments')
      .select('appt_date, appt_time, status, client_id, client_name, reason')
      .in('appt_date', dates);

    const apptKey = (d, t, reason) => `${clean(d)}|${clean(t).slice(0, 5)}|${lower(reason)}`;
    const taken = new Set((dbAppts || []).map((a) => apptKey(a.appt_date, a.appt_time, a.reason)));

    for (const a of srcAppts) {
      if (!a.appt_date || !a.appt_time) { summary.turnosOmitidos++; continue; }

      const dni = dniOf(a.client_id);
      const dbClientId = dbIdByDni.get(dni) || null;
      const dbClient = dni ? dbByDni.get(dni) : null;
      const isTaller = a.created_by === 'taller';

      if (!dbClientId && !isTaller) { summary.turnosOmitidos++; continue; }
      if (!dbClientId && isTaller && !clean(a.client_name)) { summary.turnosOmitidos++; continue; }

      const patente = clean(a.patente) || patenteOf(a.vehicle_id);
      const vehicleId = vidByPatente.get(patente.toUpperCase()) || null;
      const key = apptKey(a.appt_date, a.appt_time, a.reason);
      if (taken.has(key)) { summary.turnosOmitidos++; continue; }

      const { error } = await client.from('appointments').insert({
        client_id: dbClientId,
        vehicle_id: vehicleId,
        appt_date: a.appt_date,
        appt_time: clean(a.appt_time),
        status: APPT_STATUSES.includes(a.status) ? a.status : 'pendiente',
        reason: clean(a.reason),
        notes: clean(a.notes),
        client_name: clean(a.client_name) || clean(dbClient?.name),
        client_phone: clean(a.client_phone) || clean(dbClient?.phone),
        patente,
        created_by: isTaller ? 'taller' : 'cliente',
      });

      if (error) {
        summary.turnosOmitidos++;
        if (error.code !== '23505') summary.avisos.push(`Turno ${a.appt_date} ${a.appt_time}: ${error.message}`);
        continue;
      }
      taken.add(key);
      summary.turnos++;
    }
  }

  if (summary.clientesPendientes.length > 0) {
    summary.avisos.push(
      `${summary.clientesPendientes.length} cliente(s) todavía no tienen cuenta: cuando se registren con su DNI, volvé a importar el mismo archivo y se completa solo (no duplica nada).`
    );
  }
  return summary;
}
