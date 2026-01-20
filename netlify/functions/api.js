import express from 'express';
import pg from 'pg';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cors from 'cors';
import dotenv from 'dotenv';
import serverless from 'serverless-http';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// PostgreSQL Configuration (Neon)
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Create tables if they don't exist
const initDb = async () => {
    try {
        // Create PDFs table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pdfs (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT DEFAULT 'Unknown',
            price NUMERIC DEFAULT 0,
            category TEXT NOT NULL,
            description TEXT,
            cloudinary_id TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            locked BOOLEAN DEFAULT TRUE
          );
        `);

        // Create Purchases table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS purchases (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            pdf_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_email, pdf_id)
          );
        `);

        // Create Payment Requests table
        await pool.query(`
          CREATE TABLE IF NOT EXISTS payment_requests (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            user_name TEXT,
            pdf_id TEXT NOT NULL,
            pdf_title TEXT,
            utr_id TEXT NOT NULL,
            amount NUMERIC,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(utr_id)
          );
        `);
    } catch (err) {
        console.error('❌ Database Init Error:', err.message);
    }
};
initDb();

// Cloudinary Storage Engine for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'edumax_pdfs',
        format: async (req, file) => 'pdf',
        public_id: (req, file) => `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
        resource_type: 'image',
        access_mode: 'public'
    },
});

const upload = multer({ storage: storage });

const router = express.Router();

// Routes
router.post('/pdfs', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { title, author, price, category, description } = req.body;
        if (!title || !category) return res.status(400).json({ error: 'Title and Category are required' });

        const isLocked = (Number(price) || 0) > 0;

        const query = `
      INSERT INTO pdfs (title, author, price, category, description, cloudinary_id, file_url, file_name, locked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

        const values = [
            title, author || 'Unknown', Number(price) || 0, category, description,
            req.file.filename, req.file.path, req.file.originalname, isLocked
        ];

        const result = await pool.query(query, values);
        const savedPdf = result.rows[0];

        res.status(201).json({ ...savedPdf, _id: savedPdf.id, fileId: savedPdf.id });
    } catch (err) {
        console.error('❌ Upload Workflow Failure:', err);
        res.status(500).json({
            error: 'Failed to process PDF upload',
            details: err.message
        });
    }
});

router.get('/pdfs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pdfs ORDER BY created_at DESC');
        res.json(result.rows.map(pdf => ({ ...pdf, _id: pdf.id, fileId: pdf.id })));
    } catch (err) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

router.get('/pdfs/file/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT file_url FROM pdfs WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.redirect(result.rows[0].file_url);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/pdfs/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT cloudinary_id FROM pdfs WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        try {
            await cloudinary.uploader.destroy(result.rows[0].cloudinary_id, { resource_type: 'image' });
        } catch (e) { }

        await pool.query('DELETE FROM pdfs WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// @route POST /api/purchases
router.post('/purchases', async (req, res) => {
    const { email, pdfId } = req.body;
    if (!email || !pdfId) return res.status(400).json({ error: 'Missing email or pdfId' });

    try {
        await pool.query(
            'INSERT INTO purchases (user_email, pdf_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [email, String(pdfId)]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('❌ Purchase record failed:', err);
        res.status(500).json({ error: 'Failed to record purchase' });
    }
});

// @route GET /api/purchases/check
router.get('/purchases/check', async (req, res) => {
    const { email, pdfId } = req.query;
    if (!email || !pdfId) return res.status(400).json({ error: 'Missing email or pdfId' });

    try {
        const result = await pool.query(
            'SELECT * FROM purchases WHERE user_email = $1 AND pdf_id = $2',
            [email, String(pdfId)]
        );
        res.json({ purchased: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
});

// @route POST /api/payment-requests
router.post('/payment-requests', async (req, res) => {
    const { email, name, pdfId, pdfTitle, utrId, amount } = req.body;
    if (!email || !pdfId || !utrId) return res.status(400).json({ error: 'Missing required fields' });

    try {
        await pool.query(
            'INSERT INTO payment_requests (user_email, user_name, pdf_id, pdf_title, utr_id, amount) VALUES ($1, $2, $3, $4, $5, $6)',
            [email, name, String(pdfId), pdfTitle, utrId, amount]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('❌ Payment request failed:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'This UTR/Transaction ID has already been submitted.' });
        }
        res.status(500).json({ error: 'Failed to submit payment request' });
    }
});

// @route GET /api/payment-requests/status
router.get('/payment-requests/status', async (req, res) => {
    const { email, pdfId } = req.query;
    try {
        const result = await pool.query(
            'SELECT status FROM payment_requests WHERE user_email = $1 AND pdf_id = $2 ORDER BY created_at DESC LIMIT 1',
            [email, String(pdfId)]
        );
        res.json({ status: result.rows.length > 0 ? result.rows[0].status : null });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// @route GET /api/admin/payment-requests
router.get('/admin/payment-requests', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payment_requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// @route POST /api/admin/approve-payment
router.post('/admin/approve-payment', async (req, res) => {
    const { requestId, email, pdfId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE payment_requests SET status = $1 WHERE id = $2', ['approved', requestId]);
        await client.query(
            'INSERT INTO purchases (user_email, pdf_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [email, String(pdfId)]
        );
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Failed' });
    } finally {
        client.release();
    }
});

// @route POST /api/admin/reject-payment
router.post('/admin/reject-payment', async (req, res) => {
    const { requestId } = req.body;
    try {
        await pool.query('UPDATE payment_requests SET status = $1 WHERE id = $2', ['rejected', requestId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Mount router for both local dev and production Netlify paths
app.use('/.netlify/functions/api', router);
app.use('/api', router);
app.use('/', router);

export const handler = serverless(app);
