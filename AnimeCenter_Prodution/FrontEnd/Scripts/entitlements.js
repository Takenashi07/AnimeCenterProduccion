import { supabase } from './supabaseClient.js';

const TIER_RANK = { free: 0, basic: 1, adult: 2 };

export const TIER_LABELS = {
    free: 'Gratis',
    basic: 'Ver series',
    adult: 'Series + contenido adulto',
};

// Nivel más alto de suscripción con status "authorized" que tenga el usuario.
// El estado siempre se lee de la tabla `subscriptions` (solo el service role
// puede escribirla desde las Edge Functions) — nunca de algo editable por el
// propio usuario.
export async function getActiveTier() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'free';

    // Los admins tienen acceso completo sin pagar. is_admin ya no se puede
    // auto-otorgar el propio usuario (hay un trigger en la base de datos que
    // lo bloquea), así que confiar en este valor aquí es seguro.
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (profile?.is_admin) return 'adult';

    const { data } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', session.user.id)
        .eq('status', 'authorized')
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle();

    return data?.tier ?? 'free';
}

export function tierMeets(tier, required) {
    return TIER_RANK[tier] >= TIER_RANK[required];
}
