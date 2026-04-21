import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvcqzxperpqcgwbihpam.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2Y3F6eHBlcnBxY2d3YmlocGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTI4OTcsImV4cCI6MjA5MjMyODg5N30.hFki832gbTSAj6hH0gDH18auJJVE-hfmEEF63kS2xt4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
