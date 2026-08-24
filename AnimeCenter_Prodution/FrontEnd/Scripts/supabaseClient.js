// Cliente de Supabase — se importa desde auth.js
// No requiere npm/bundler: se carga como módulo ES directo desde el navegador.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Reemplaza estos dos valores con los de tu proyecto:
// Supabase Dashboard → Project Settings → API
const SUPABASE_URL = 'https://mmqftphezdhjogkjrosg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qV609fv64ZxrfxOiPH4L2Q_e1bzd-EJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);