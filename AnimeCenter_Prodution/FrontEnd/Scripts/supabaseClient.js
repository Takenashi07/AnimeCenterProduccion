// Cliente de Supabase — se importa desde auth.js
// No requiere npm/bundler: se carga como módulo ES directo desde el navegador.

// Versión fija: con "@2" el CDN podía entregar cualquier versión nueva sin
// avisar, y este código corre con acceso a la sesión del usuario.
// Para actualizar, cambia el número a propósito y prueba el login.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

// Reemplaza estos dos valores con los de tu proyecto:
// Supabase Dashboard → Project Settings → API
const SUPABASE_URL = 'https://mmqftphezdhjogkjrosg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qV609fv64ZxrfxOiPH4L2Q_e1bzd-EJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL };