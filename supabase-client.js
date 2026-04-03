const SUPABASE_URL = "https://dzririwzipewnbwfekkx.supabase.co";
const SUPABASE_KEY = "sb_publishable_XX10TnpwP3JBSD4Wur_vlA_y9nwOq5t";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase Client erstellt:", supabaseClient);