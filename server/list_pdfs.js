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
    try {
        const result = await pool.query('SELECT * FROM pdfs ORDER BY created_at DESC');
        console.log('PDFs in Database (Neon):');
        console.log(JSON.stringify(result.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error fetching from Neon:', err);
        process.exit(1);
    }
}

check();
