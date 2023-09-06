types:
	pnpm supabase gen types typescript --local | \
	sed 's/export interface Database {/export type Database = {/' \
	> test/database.ts

reset:
	pnpm supabase db reset