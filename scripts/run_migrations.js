const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        const migrations = [
            'supabase/migrations/004_add_super_admin_role.sql',
            'supabase/migrations/005_admin_guru_assignments.sql'
        ];

        for (const migration of migrations) {
            console.log(`Running ${migration}...`);
            const sql = fs.readFileSync(path.join(process.cwd(), migration), 'utf8');
            await client.query(sql);
            console.log(`Finished ${migration}`);
        }

        console.log('All migrations completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
