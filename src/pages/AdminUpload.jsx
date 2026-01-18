import React, { useState, useEffect } from 'react';
import { Upload, Check, AlertCircle, Trash2 } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import { useNavigate } from 'react-router-dom';

const AdminUpload = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        price: '',
        category: '',
        description: ''
    });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error'
    const [managedPdfs, setManagedPdfs] = useState([]);

    const loadManagedPdfs = () => {
        try {
            const defaultMockPdfs = [
                { id: '1', title: 'Calculus I - Complete Notes', author: 'Dr. Smith', price: 500, locked: true, category: 'state' },
                { id: '2', title: 'Introduction to React', author: 'Edumax Team', price: 0, locked: false, category: 'btech' },
                { id: '3', title: 'Advanced Physics Vol. 1', author: 'Prof. Johnson', price: 1200, locked: true, category: '12th' },
            ];

            const deletedIds = JSON.parse(localStorage.getItem('edumax_deletedPdfIds') || '[]').map(String);
            const visibleMockPdfs = defaultMockPdfs.filter(pdf => !deletedIds.includes(String(pdf.id)));
            const uploadedPdfs = JSON.parse(localStorage.getItem('edumax_uploadedPdfs') || '[]');

            setManagedPdfs([...uploadedPdfs, ...visibleMockPdfs]);
        } catch (err) {
            console.error('Failed to load PDFs:', err);
        }
    };

    useEffect(() => {
        loadManagedPdfs();
        window.addEventListener('edumax-sync', loadManagedPdfs);
        return () => window.removeEventListener('edumax-sync', loadManagedPdfs);
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDelete = (id) => {
        console.log('Admin: Attempting to delete PDF ID:', id);
        if (window.confirm('Are you sure you want to delete this PDF?')) {
            try {
                const uploadedPdfs = JSON.parse(localStorage.getItem('edumax_uploadedPdfs') || '[]');
                const isUploaded = uploadedPdfs.some(p => String(p.id) === String(id));

                console.log('Admin: isUploaded?', isUploaded);

                if (isUploaded) {
                    const updated = uploadedPdfs.filter(pdf => String(pdf.id) !== String(id));
                    localStorage.setItem('edumax_uploadedPdfs', JSON.stringify(updated));
                    console.log('Admin: Deleted from uploadedPdfs. Remaining:', updated.length);
                } else {
                    const deletedIds = JSON.parse(localStorage.getItem('edumax_deletedPdfIds') || '[]');
                    if (!deletedIds.includes(String(id))) {
                        const newDeletedIds = [...deletedIds, String(id)];
                        localStorage.setItem('edumax_deletedPdfIds', JSON.stringify(newDeletedIds));
                        console.log('Admin: Added to deletedMockIds:', newDeletedIds);
                    }
                }

                // Dispatch sync event with data for better tracking
                window.dispatchEvent(new CustomEvent('edumax-sync', { detail: { action: 'delete', id } }));
                loadManagedPdfs();
            } catch (err) {
                console.error('Admin: Delete failed:', err);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Admin: handleSubmit triggered');

        if (!file) {
            console.error('Admin: No file selected');
            alert('Please select a PDF file first.');
            return;
        }

        // LocalStorage limit is usually 5-10MB. Base64 adds ~33% overhead.
        // We should limit files to ~3.5MB to stay safe.
        if (file.size > 3.5 * 1024 * 1024) {
            alert('File is too large for browser demo storage. Please use a PDF smaller than 3.5MB.');
            return;
        }

        setLoading(true);
        setStatus(null);

        // Convert file to Base64
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result;

            // Simulate API call delay
            setTimeout(() => {
                try {
                    const newPdf = {
                        id: Date.now().toString(),
                        ...formData,
                        fileName: file.name,
                        fileData: base64Data, // Save the actual PDF content
                        createdAt: new Date().toISOString(),
                        locked: true
                    };

                    console.log('Admin: Saving new PDF with data (length):', base64Data.length);

                    const existingPdfs = JSON.parse(localStorage.getItem('edumax_uploadedPdfs') || '[]');
                    const updatedPdfs = [newPdf, ...existingPdfs];
                    localStorage.setItem('edumax_uploadedPdfs', JSON.stringify(updatedPdfs));

                    console.log('Admin: Storage updated. New count:', updatedPdfs.length);

                    // Dispatch detailed sync event
                    window.dispatchEvent(new CustomEvent('edumax-sync', {
                        detail: { action: 'upload', title: newPdf.title }
                    }));

                    setLoading(false);
                    setStatus('success');
                    setFormData({ title: '', author: '', price: '', category: '', description: '' });
                    setFile(null);

                    console.log('Admin: Upload flow complete');

                    setTimeout(() => setStatus(null), 3000);
                } catch (err) {
                    console.error('Admin: Upload failed (probably storage limit):', err);
                    alert('Could not save PDF. The document might be too large for browser storage.');
                    setLoading(false);
                    setStatus('error');
                }
            }, 800);
        };

        reader.onerror = () => {
            console.error('Admin: File reading failed');
            alert('Failed to read the PDF file.');
            setLoading(false);
        };

        reader.readAsDataURL(file);
    };

    return (
        <div className="container" style={{ padding: 'var(--space-lg) var(--space-md)', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>

                {/* Upload Section */}
                <div>
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }}>
                            Upload Document
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Add new learning resources to the library</p>
                    </div>

                    <div className="glass" style={{ padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)' }}>
                        {status === 'success' && (
                            <div style={{
                                padding: 'var(--space-sm)',
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: 'var(--success)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: 'var(--space-md)',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <Check size={18} /> Upload successful!
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div style={{
                                border: '2px dashed var(--glass-border)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-lg)',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: 'rgba(255,255,255,0.02)',
                                transition: 'border-color 0.2s',
                                position: 'relative'
                            }}>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    required
                                    style={{
                                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                        opacity: 0, cursor: 'pointer'
                                    }}
                                />
                                <Upload size={32} style={{ color: 'var(--primary)', marginBottom: 'var(--space-sm)' }} />
                                <p style={{ fontWeight: '500' }}>{file ? file.name : 'Click to select PDF'}</p>
                            </div>

                            <Input
                                label="Title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. 12th Grade Physics Notes"
                                required
                            />

                            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                <div style={{ flex: 1 }}>
                                    <Input
                                        label="Author"
                                        name="author"
                                        value={formData.author}
                                        onChange={handleChange}
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Input
                                        label="Price (₹)"
                                        name="price"
                                        type="number"
                                        value={formData.price}
                                        onChange={handleChange}
                                        placeholder="0 for Free"
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)' }}>
                                    Category
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%', padding: '12px 16px',
                                        background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)',
                                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none'
                                    }}
                                    required
                                >
                                    <option value="" disabled>Select Category</option>
                                    <optgroup label="Boards">
                                        <option value="10th">10th Board</option>
                                        <option value="12th">12th Board</option>
                                    </optgroup>
                                    <optgroup label="Higher Education">
                                        <option value="btech">B.Tech</option>
                                        <option value="state">General State Board</option>
                                    </optgroup>
                                    <optgroup label="Specific States">
                                        <option value="Andhra Pradesh">Andhra Pradesh</option>
                                        <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                                        <option value="Assam">Assam</option>
                                        <option value="Bihar">Bihar</option>
                                        <option value="Chhattisgarh">Chhattisgarh</option>
                                        <option value="Goa">Goa</option>
                                        <option value="Gujarat">Gujarat</option>
                                        <option value="Haryana">Haryana</option>
                                        <option value="Himachal Pradesh">Himachal Pradesh</option>
                                        <option value="Jharkhand">Jharkhand</option>
                                        <option value="Karnataka">Karnataka</option>
                                        <option value="Kerala">Kerala</option>
                                        <option value="Madhya Pradesh">Madhya Pradesh</option>
                                        <option value="Maharashtra">Maharashtra</option>
                                        <option value="Manipur">Manipur</option>
                                        <option value="Meghalaya">Meghalaya</option>
                                        <option value="Mizoram">Mizoram</option>
                                        <option value="Nagaland">Nagaland</option>
                                        <option value="Odisha">Odisha</option>
                                        <option value="Punjab">Punjab</option>
                                        <option value="Rajasthan">Rajasthan</option>
                                        <option value="Sikkim">Sikkim</option>
                                        <option value="Tamil Nadu">Tamil Nadu</option>
                                        <option value="Telangana">Telangana</option>
                                        <option value="Tripura">Tripura</option>
                                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                                        <option value="Uttarakhand">Uttarakhand</option>
                                        <option value="West Bengal">West Bengal</option>
                                    </optgroup>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <Button type="submit" disabled={loading}>
                                {loading ? 'Uploading...' : 'Upload Document'}
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Management Section */}
                <div>
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <h2 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>
                            Manage Documents
                        </h2>
                        <p style={{ color: 'var(--text-secondary)' }}>View and remove items from the library</p>
                    </div>

                    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {managedPdfs.length === 0 ? (
                                <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No documents found.
                                </p>
                            ) : (
                                managedPdfs.map((pdf) => (
                                    <div key={pdf.id} style={{
                                        padding: 'var(--space-md)',
                                        borderBottom: '1px solid var(--glass-border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)',
                                        transition: 'background 0.2s',
                                        cursor: 'pointer'
                                    }}>
                                        <div style={{
                                            width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', color: 'var(--primary)'
                                        }}>
                                            <Upload size={20} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {pdf.title}
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {pdf.category} | ₹{pdf.price}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(pdf.id)}
                                            style={{
                                                padding: '8px', background: 'transparent', border: 'none',
                                                color: 'var(--error)', cursor: 'pointer', borderRadius: '50%',
                                                transition: 'background 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminUpload;
