import React, { useState, useEffect } from 'react';
import { Check, X, Clock, User, FileText, CreditCard } from 'lucide-react';
import Button from '../components/Button';

const AdminPayments = () => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const API_URL = import.meta.env.VITE_API_URL || '/api';

    const fetchRequests = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/payment-requests`);
            if (response.ok) {
                const data = await response.json();
                setRequests(data);
            }
        } catch (err) {
            console.error('Failed to fetch payment requests');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (request) => {
        if (!window.confirm(`Approve payment of ₹${request.amount} for ${request.user_email}?`)) return;

        try {
            const response = await fetch(`${API_URL}/admin/approve-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: request.id,
                    email: request.user_email,
                    pdfId: request.pdf_id
                })
            });

            if (response.ok) {
                alert('✅ Payment approved and PDF unlocked for user!');
                fetchRequests();
            }
        } catch (err) {
            alert('❌ Failed to approve payment');
        }
    };

    const handleReject = async (requestId) => {
        if (!window.confirm('Reject this payment request?')) return;

        try {
            const response = await fetch(`${API_URL}/admin/reject-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId })
            });

            if (response.ok) {
                alert('Rejected');
                fetchRequests();
            }
        } catch (err) {
            alert('Failed to reject');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="container" style={{ paddingTop: 'var(--space-xl)' }}>
            <div className="glass" style={{ padding: 'var(--space-lg)', borderRadius: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }}>Payment Verification</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Review and approve manual UPI/QR payments</p>
                    </div>
                    <Button variant="ghost" onClick={fetchRequests}>Refresh List</Button>
                </div>

                <div style={{ marginBottom: 'var(--space-md)' }}>
                    <input
                        type="text"
                        placeholder="Search by UTR ID or Email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 20px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}>Loading requests...</div>
                ) : requests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px' }}>
                        <Clock size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>No payment requests found.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Date</th>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>User</th>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Document</th>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>UTR / Transaction ID</th>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Amount</th>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Status</th>
                                    <th style={{ padding: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests
                                    .filter(req =>
                                        req.utr_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        req.user_email.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map((request) => (
                                        <tr key={request.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '15px', fontSize: '0.9rem' }}>{formatDate(request.created_at)}</td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                                        {request.user_name?.[0] || 'U'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '500' }}>{request.user_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{request.user_email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FileText size={16} style={{ color: 'var(--accent)' }} />
                                                    <span style={{ fontSize: '0.9rem' }}>{request.pdf_title}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                    {request.utr_id}
                                                </code>
                                            </td>
                                            <td style={{ padding: '15px', fontWeight: '600' }}>₹{request.amount}</td>
                                            <td style={{ padding: '15px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    background: request.status === 'approved' ? 'rgba(76, 175, 80, 0.1)' : request.status === 'rejected' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                                                    color: request.status === 'approved' ? '#4CAF50' : request.status === 'rejected' ? '#F44336' : '#FF9800',
                                                    border: `1px solid ${request.status === 'approved' ? '#4CAF50' : request.status === 'rejected' ? '#F44336' : '#FF9800'}33`
                                                }}>
                                                    {request.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                {request.status === 'pending' && (
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button
                                                            onClick={() => handleApprove(request)}
                                                            style={{ background: '#4CAF50', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                                                            title="Approve"
                                                        >
                                                            <Check size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(request.id)}
                                                            style={{ background: '#F44336', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                                                            title="Reject"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
                tr:hover {
                    background: rgba(255,255,255,0.02);
                }
            `}</style>
        </div>
    );
};

export default AdminPayments;
