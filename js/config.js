// Configuración de Supabase.
// La "publishable key" (anon) está pensada para usarse en el navegador:
// la seguridad real la dan las políticas RLS definidas en supabase/schema.sql.
// Nunca pongas aquí la "secret key" / service_role.
window.APP_CONFIG = {
    SUPABASE_URL: 'https://xcozqrjfblgvsboydbax.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_m1rKko6j-yz0O4ImhKlIrA_AK6sVptn',
    // Cuenta única del equipo (creada en Supabase → Authentication → Users).
    // Con esto la pantalla de login solo pide la contraseña.
    // Déjalo en '' para pedir correo y contraseña (usuarios individuales).
    TEAM_EMAIL: 'equipo@fastcheck-innexa.com',
    TABLE: 'fast_check_ideas',
    SYNC_INTERVAL_MS: 3000
};
