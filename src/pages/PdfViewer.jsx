import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, Lock, CreditCard, ShieldAlert } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF worker using CDN to avoid build issues with Vite/Rollup
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfViewer = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    const UPI_ID = import.meta.env.VITE_UPI_ID || 'vivekpanjab5445@ybl';
    const UPI_NAME = import.meta.env.VITE_UPI_NAME || 'Edumax';

    const [numPages, setNumPages] = useState(null);
    const [pdfMetadata, setPdfMetadata] = useState(null);
    const [isPaid, setIsPaid] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [metadataLoaded, setMetadataLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [utrId, setUtrId] = useState('');
    const [paymentRequestStatus, setPaymentRequestStatus] = useState(null); // 'pending', 'approved', 'rejected'
    const [containerWidth, setContainerWidth] = useState(window.innerWidth);
    const [pageWidth, setPageWidth] = useState(window.innerWidth > 800 ? 800 : window.innerWidth - 30);
    const [isWindowFocused, setIsWindowFocused] = useState(true);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const containerRef = React.useRef(null);
    const isAdmin = localStorage.getItem('role') === 'admin';
    const userEmail = localStorage.getItem('userEmail') || 'Secure User';

    // Handle Responsive Resize with Ref
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.clientWidth;
                setContainerWidth(width);
                // Calculate ideal page width (max 850px, otherwise full width minus padding)
                const padding = width < 768 ? 20 : 60;
                setPageWidth(Math.min(width - padding, 850));
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        // Small delay to ensure DOM is ready
        const timer = setTimeout(updateWidth, 100);

        return () => {
            window.removeEventListener('resize', updateWidth);
            clearTimeout(timer);
        };
    }, [metadataLoaded]);

    // Check if previously purchased (Database + LocalStorage)
    useEffect(() => {
        const checkPurchaseStatus = async () => {
            if (!id) return;

            // 1. Check LocalStorage first (Quick)
            const purchases = JSON.parse(localStorage.getItem('edumax_purchases') || '[]');
            if (purchases.includes(id)) {
                console.log('Document previously purchased (local), unlocking');
                setIsPaid(true);
                return;
            }

            // 2. Check Database (Permanent)
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail) {
                try {
                    console.log('Checking database for purchase status...');
                    const response = await fetch(`${API_URL}/purchases/check?email=${userEmail}&pdfId=${id}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.purchased) {
                            console.log('✅ Purchase verified in database, unlocking');
                            setIsPaid(true);

                            // Also sync to local
                            purchases.push(id);
                            localStorage.setItem('edumax_purchases', JSON.stringify(purchases));
                        }
                    }
                } catch (err) {
                    console.warn('Backend purchase check failed, relying on local state');
                }
            }
        };

        checkPurchaseStatus();
    }, [id, API_URL]);

    // Injection of modal and watermark animations
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes modalSlideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .watermark-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 5;
                overflow: hidden;
                opacity: 0.15;
                font-size: 14px;
                color: #ccc;
                display: flex;
                flex-wrap: wrap;
                gap: 100px;
                justify-content: center;
                align-content: center;
                user-select: none;
            }
            .blur-protection {
                filter: blur(60px) grayscale(100%);
                transition: filter 0.1s ease;
            }
            .moving-watermark {
                position: fixed;
                pointer-events: none;
                z-index: 9999;
                font-size: 12px;
                font-weight: bold;
                color: rgba(255, 255, 255, 0.4);
                background: rgba(0, 0, 0, 0.2);
                padding: 4px 10px;
                border-radius: 20px;
                white-space: nowrap;
                backdrop-filter: blur(2px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: transform 0.05s linear;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // Check for existing payment request
    useEffect(() => {
        const checkRequestStatus = async () => {
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail && id) {
                try {
                    const response = await fetch(`${API_URL}/payment-requests/status?email=${userEmail}&pdfId=${id}`);
                    if (response.ok) {
                        const data = await response.json();
                        setPaymentRequestStatus(data.status);
                    }
                } catch (err) {
                    console.warn('Failed to check payment request status');
                }
            }
        };

        if (showPaymentModal || !isPaid) {
            checkRequestStatus();
        }
    }, [id, API_URL, showPaymentModal, isPaid]);

    // Industry standard worker configuration for Vite
    useEffect(() => {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    }, []);

    useEffect(() => {
        console.group('Viewer: Initialization');

        const loadMetadata = async () => {
            console.log('Document ID:', id);

            try {
                // Fetch specific PDF from backend
                const response = await fetch(`${API_URL}/pdfs`);
                if (response.ok) {
                    const pdfs = await response.json();
                    const found = pdfs.find(p => String(p._id) === String(id));

                    if (found) {
                        console.log('Metadata found:', found.title);
                        setPdfMetadata(found);

                        if (Number(found.price) === 0) {
                            console.log('Document is free, unlocking all pages');
                            setIsPaid(true);
                        } else {
                            console.log(`Document price is ${found.price}, checking purchase status...`);
                        }
                    } else {
                        console.error('Document not found in storage!');
                    }
                }
            } catch (err) {
                console.error('Viewer: Failed to fetch metadata', err);
            } finally {
                setMetadataLoaded(true);
                console.groupEnd();
            }
        };

        loadMetadata();
    }, [id, isAdmin]);

    const pdfFile = pdfMetadata?.fileId ? `${API_URL}/pdfs/file/${pdfMetadata.fileId}?email=${encodeURIComponent(userEmail)}` : null;

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const submitPaymentRequest = async () => {
        if (!utrId.trim()) {
            alert("Please enter a valid Transaction ID / UTR.");
            return;
        }

        setIsLoading(true);
        const userEmail = localStorage.getItem('userEmail');
        const userName = localStorage.getItem('userName') || 'User';

        try {
            const response = await fetch(`${API_URL}/payment-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    name: userName,
                    pdfId: id,
                    pdfTitle: pdfMetadata?.title,
                    utrId: utrId,
                    amount: pdfMetadata?.price
                })
            });

            if (response.ok) {
                setPaymentRequestStatus('pending');
                alert("✅ Payment Request Submitted! Admin will verify your UTR and unlock the PDF soon.");
            } else {
                const data = await response.json();
                alert(`❌ Error: ${data.error || 'Failed to submit request'}`);
            }
        } catch (err) {
            alert("❌ Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Aggressive security handlers
    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        const handleCopy = (e) => {
            e.preventDefault();
            navigator.clipboard.writeText('Protected Content - Edumax');
        };
        const handleVisibilityChange = () => {
            setIsWindowFocused(!document.hidden);
        };
        const handleBlur = () => setIsWindowFocused(false);
        const handleFocus = () => setIsWindowFocused(true);
        const handleMouseLeave = () => setIsWindowFocused(false);
        const handleMouseEnter = () => setIsWindowFocused(true);
        const handleMouseMove = (e) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        const handleKeyDown = (e) => {
            // Block PrintScreen specifically
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                setIsWindowFocused(false);
                navigator.clipboard.writeText('Screenshots are prohibited.');
                alert('SCREENSHOT ATTEMPT DETECTED: Content hidden.');
            }

            // Existing blocks
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'u' || e.key === 'c')) {
                e.preventDefault();
                return false;
            }

            // Block DevTools shortcuts
            if (e.key === 'F12' ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))
            ) {
                e.preventDefault();
            }
        };

        // Periodic clipboard scavenger (clears any content copied by system tools)
        const scavenger = setInterval(() => {
            if (!isWindowFocused) {
                navigator.clipboard.writeText('Security Clearance Active');
            }
        }, 1000);

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            clearInterval(scavenger);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [isWindowFocused]);

    if (!metadataLoaded) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            Initializing secure viewer...
        </div>;
    }

    return (
        <div style={{
            height: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none',
            MozUserSelect: 'none'
        }}>
            {/* Dynamic Moving Watermark (Deterrent) */}
            {isWindowFocused && (
                <div
                    className="moving-watermark"
                    style={{
                        transform: `translate(${mousePos.x + 20}px, ${mousePos.y + 20}px)`
                    }}
                >
                    {userEmail} • SECURE ACCESS • {new Date().toLocaleTimeString()}
                </div>
            )}
            {/* Header */}
            <div className="glass" style={{
                padding: 'var(--space-sm) var(--space-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10
            }}>
                {isPaid && pdfMetadata?.price > 0 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '-40px',
                        left: '0',
                        right: '0',
                        backgroundColor: 'var(--success)',
                        color: 'white',
                        padding: '8px',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        zIndex: 5,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                        ✨ Payment Verified: Full Document Unlocked
                    </div>
                )}
                <div className="flex items-center gap-sm">
                    <Button variant="ghost" onClick={() => navigate('/library')}>
                        <ArrowLeft size={20} /> Back
                    </Button>
                    <h3 style={{ marginLeft: 'var(--space-md)' }}>
                        {pdfMetadata?.title || 'Document Viewer'}
                    </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontSize: '0.8rem' }}>
                        <ShieldAlert size={16} />
                        <span className="desktop-only">Secure Restricted Access</span>
                    </div>
                    {isAdmin && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsPaid(true)}
                                style={{
                                    fontSize: '0.7rem',
                                    padding: '4px 10px',
                                    borderColor: 'var(--primary)',
                                    color: 'var(--primary)'
                                }}
                            >
                                [Admin] Bypass Lock
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Viewer */}
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: containerWidth < 768 ? '10px' : '40px',
                    position: 'relative',
                    backgroundColor: '#525659'
                }}
                className={!isWindowFocused ? 'blur-protection' : ''}
            >
                {!isWindowFocused && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        textAlign: 'center'
                    }}>
                        <div className="glass" style={{ padding: '30px', borderRadius: '20px', border: '1px solid var(--accent)' }}>
                            <ShieldAlert size={48} style={{ color: 'var(--accent)', marginBottom: '15px' }} />
                            <h2>Content Protected</h2>
                            <p style={{ marginTop: '10px' }}>Please focus on this window to view the secure document.</p>
                            <Button variant="primary" style={{ marginTop: '20px' }} onClick={() => window.focus()}>Resume Viewing</Button>
                        </div>
                    </div>
                )}
                <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div style={{ color: 'white', padding: 'var(--space-xl)' }}>Opening document...</div>}
                    error={<div style={{ color: 'var(--error)', padding: 'var(--space-xl)', textAlign: 'center' }}>
                        <p><strong>Failed to load PDF.</strong></p>
                        <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>This may be due to browser security settings or a corrupted file.</p>
                        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} style={{ marginTop: 'var(--space-md)' }}>Retry</Button>
                    </div>}
                >
                    {Array.from(new Array(numPages), (el, index) => (
                        <div
                            key={`page_${index + 1}`}
                            style={{
                                marginBottom: '20px',
                                position: 'relative',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                width: '100%',
                                maxWidth: `${pageWidth}px`,
                                margin: '0 auto 20px auto'
                            }}
                        >
                            {/* Blur Overlay for unpaid pages > 1 */}
                            {!isPaid && index > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backdropFilter: 'blur(30px)',
                                    WebkitBackdropFilter: 'blur(30px)',
                                    zIndex: 10,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(5, 10, 20, 0.95)',
                                    color: 'white',
                                    textAlign: 'center',
                                    padding: 'var(--space-md)',
                                    overflow: 'hidden' // Contain the watermark
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: '15%',
                                        left: '-20%',
                                        transform: 'rotate(-45deg)',
                                        fontSize: containerWidth < 768 ? '4rem' : '8rem',
                                        fontWeight: '900',
                                        opacity: 0.1,
                                        pointerEvents: 'none',
                                        whiteSpace: 'nowrap'
                                    }}>SECURE CONTENT</div>
                                    <Lock size={64} style={{ marginBottom: 'var(--space-md)', color: 'var(--accent)' }} />
                                    <h2 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.8rem' }}>Document Locked</h2>
                                    <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                                        Access to "{pdfMetadata?.title}" is restricted. Purchase to unlock and read.
                                    </p>
                                    <Button variant="primary" size="lg" onClick={() => setShowPaymentModal(true)} style={{ boxShadow: '0 0 20px var(--accent-glow)' }}>
                                        Unlock Full PDF - ₹{pdfMetadata?.price || '0'}
                                    </Button>
                                    <div style={{ marginTop: 'var(--space-xl)', fontSize: '0.7rem', opacity: 0.5 }}>
                                        Secure Content &copy; Edumax Learning
                                    </div>
                                </div>
                            )}

                            {/* Transparent overlay to block drag/drop/interaction */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 1
                            }} />

                            <Page
                                pageNumber={index + 1}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                width={pageWidth}
                            />

                            {/* Dynamic User Watermark */}
                            <div className="watermark-overlay">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} style={{ transform: 'rotate(-30deg)', whiteSpace: 'nowrap' }}>
                                        {userEmail} • EDUMAX SECURE • {new Date().toLocaleDateString()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </Document>
            </div>

            {/* Manual Payment Modal */}
            {showPaymentModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '450px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        animation: 'modalSlideUp 0.3s ease-out',
                        border: '1px solid rgba(255,255,255,0.1)',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => setShowPaymentModal(false)}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'rgba(255,165,0,0.2)',
                                border: 'none',
                                color: 'white',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >✕</button>

                        <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                            <h2 style={{ color: 'white', marginBottom: 'var(--space-sm)' }}>Scan & Pay</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
                                Pay ₹{pdfMetadata?.price} via UPI to unlock "{pdfMetadata?.title}"
                            </p>

                            {/* QR Code Placeholder/Image */}
                            <div style={{
                                width: '220px',
                                height: '220px',
                                background: 'white',
                                margin: '0 auto var(--space-lg)',
                                borderRadius: '15px',
                                padding: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(0,0,0,0.3)'
                            }}>
                                <img
                                    src="/payment_qr.png"
                                    alt="UPI QR Code"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    onError={(e) => {
                                        e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${pdfMetadata?.price || 0}&cu=INR`;
                                    }}
                                />
                            </div>

                            {/* UPI Deep Link Button (Mobile Only/Preferred) */}
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <Button
                                    variant="secondary"
                                    fullWidth
                                    onClick={() => {
                                        const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${pdfMetadata?.price || 0}&cu=INR`;
                                        window.location.href = upiUrl;
                                    }}
                                    style={{
                                        background: '#3392FF',
                                        color: 'white',
                                        borderColor: '#3392FF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <CreditCard size={18} /> Pay with UPI App (GPay/PhonePe)
                                </Button>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                    Clicking this will open your UPI app automatically.
                                </p>
                            </div>

                            <div style={{ margin: 'var(--space-md) 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                            {paymentRequestStatus === 'pending' ? (
                                <div style={{
                                    padding: '20px',
                                    background: 'rgba(255,165,0,0.1)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,165,0,0.3)',
                                    color: '#FFA500'
                                }}>
                                    <p style={{ fontWeight: '600' }}>Payment Verification Pending</p>
                                    <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                                        We are verifying your UTR ({utrId}). Access will be granted once approved.
                                    </p>
                                </div>
                            ) : paymentRequestStatus === 'rejected' ? (
                                <div style={{
                                    padding: '20px',
                                    background: 'rgba(255,0,0,0.1)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,0,0,0.3)',
                                    color: '#FF4D4D'
                                }}>
                                    <p style={{ fontWeight: '600' }}>Verification Failed</p>
                                    <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                                        Previous request was rejected. Please check your UTR and submit again.
                                    </p>
                                    <div style={{ marginTop: '15px' }}>
                                        <Input
                                            placeholder="Enter UTR/Transaction ID"
                                            value={utrId}
                                            onChange={(e) => setUtrId(e.target.value)}
                                        />
                                        <Button
                                            variant="primary"
                                            fullWidth
                                            onClick={submitPaymentRequest}
                                            style={{ marginTop: '10px' }}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Submitting...' : 'Re-submit UTR'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '5px' }}>
                                            Transaction ID / UTR
                                        </label>
                                        <Input
                                            placeholder="Enter 12-digit UTR number"
                                            value={utrId}
                                            onChange={(e) => setUtrId(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        variant="primary"
                                        fullWidth
                                        onClick={submitPaymentRequest}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Submitting...' : 'I have Paid (Submit UTR)'}
                                    </Button>
                                </div>
                            )}

                            <div style={{ marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <p>🔒 100% Secure Manual Verification</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfViewer;
