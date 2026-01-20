import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function check() {
    console.log('🔍 Checking Neon PostgreSQL connection...');
    try {
        const client = await pool.connect();
        console.log('✅ Successfully connected to Neon PostgreSQL');

        const res = await client.query('SELECT current_database(), now()');
        console.log('📊 Database Info:', res.rows[0]);

        // Check tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📁 Tables in public schema:', tablesRes.rows.map(t => t.table_name));

        const pdfsCount = await client.query('SELECT COUNT(*) FROM pdfs');
        console.log(`📄 Total PDFs in database: ${pdfsCount.rows[0].count}`);

        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection Error:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.error('👉 Tip: Check your database password in the connection string.');
        }
        process.exit(1);
    }
}

check();
