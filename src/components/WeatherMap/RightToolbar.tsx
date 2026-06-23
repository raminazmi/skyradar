/**
 * RightToolbar.tsx — MapLibre version
 * شريط الأدوات الأيمن — يعمل مع MapLibre بدلاً من Leaflet
 */

import { useState, useEffect } from 'react';
import {
    FiSearch, FiInfo, FiShare2, FiCrosshair,
    FiPlus, FiMinus, FiMaximize2, FiMinimize2, FiLoader, FiSettings, FiMenu, FiSun, FiSunset,
    FiCopy, FiCheck, FiMail
} from 'react-icons/fi';
import { FaWhatsapp, FaFacebookF, FaTelegramPlane } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { useWeatherStore } from '../../store/weatherStore';
import { useMapRef } from './MapContext';
import { geocodingService, GeocodingResult } from '../../services/geocodingService';

type SearchResult = GeocodingResult;

function isCompactViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

export function RightToolbar() {
    const mapRef = useMapRef();
    const {
        sidebarOpen,
        layerControlsOpen,
        infoPanelOpen,
        settingsOpen,
        darkMode,
        setCurrentLocation,
        setSidebarOpen,
        setLayerControlsOpen,
        setInfoPanelOpen,
        setSettingsOpen,
        setDarkMode,
        setSearchOpen,
    } = useWeatherStore();

    const [showSearch, setShowSearch]       = useState(false);
    // نعكس حالة البحث للمتجر كي يخفي الشعار الذي يغطّيها (سياق تكديس منفصل)
    useEffect(() => { setSearchOpen(showSearch); }, [showSearch, setSearchOpen]);
    const [showInfo, setShowInfo]           = useState(false);
    const [showShare, setShowShare]         = useState(false);
    const [searchQuery, setSearchQuery]     = useState('');
    const [isFullscreen, setIsFullscreen]   = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [shareUrl, setShareUrl]           = useState('');
    const [copied, setCopied]               = useState(false);

    const closeFloatingPanels = () => {
        if (!isCompactViewport()) return;
        setSidebarOpen(false);
        setLayerControlsOpen(false);
        setInfoPanelOpen(false);
        setSettingsOpen(false);
    };

    const handleSearchToggle = () => {
        const willOpen = !showSearch;
        setShowSearch(willOpen);
        if (willOpen) { setShowInfo(false); setShowShare(false); closeFloatingPanels(); }
    };

    const handleInfoToggle = () => {
        const willOpen = !showInfo;
        setShowInfo(willOpen);
        if (willOpen) { setShowSearch(false); setShowShare(false); closeFloatingPanels(); }
    };

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (searchQuery.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
            setSearchLoading(true);
            try {
                const results = await geocodingService.searchCities(searchQuery, 8);
                setSearchResults(results);
            } catch { setSearchResults([]); } finally { setSearchLoading(false); }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    useEffect(() => {
        if (!isCompactViewport()) return;
        if (sidebarOpen || layerControlsOpen || infoPanelOpen || settingsOpen) {
            setShowSearch(false); setShowInfo(false); setShowShare(false);
        }
    }, [sidebarOpen, layerControlsOpen, infoPanelOpen, settingsOpen]);

    // ── Map actions ───────────────────────────────────────────────────────────
    const handleZoomIn  = () => { mapRef.current?.zoomIn();  };
    const handleZoomOut = () => { mapRef.current?.zoomOut(); };

    const handleLocate = () => {
        if (!navigator.geolocation) { alert('المتصفح لا يدعم تحديد الموقع'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setCurrentLocation(latitude, longitude);
                setInfoPanelOpen(true);
                mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 8 });
            },
            () => alert('تعذر تحديد موقعك')
        );
    };

    const handleSelectCity = (city: SearchResult) => {
        setShowSearch(false);
        setSearchQuery('');
        setCurrentLocation(city.latitude, city.longitude);
        setInfoPanelOpen(true);
        const currentZoom = mapRef.current?.getZoom() ?? 4;
        mapRef.current?.flyTo({
            center: [city.longitude, city.latitude],
            zoom: Math.max(currentZoom, 8),
            duration: 1200,
        });
    };

    const handleShare = () => {
        const center = mapRef.current?.getCenter();
        const zoom   = mapRef.current?.getZoom() ?? 4;
        const url = center
            ? `${window.location.origin}?lat=${center.lat.toFixed(4)}&lon=${center.lng.toFixed(4)}&z=${zoom.toFixed(1)}`
            : window.location.href;
        setShareUrl(url);
        setCopied(false);
        setShowShare(true);
        setShowSearch(false);
        setShowInfo(false);
        closeFloatingPanels();
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* المتصفح منع الوصول للحافظة */ }
    };

    const shareText = 'تابع حالة الطقس على Sky Radar';
    const shareTargets = [
        { key: 'whatsapp', label: 'واتساب',  Icon: FaWhatsapp,      color: '#25D366',
          href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
        { key: 'x',        label: 'X',        Icon: FaXTwitter,      color: '#000000',
          href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
        { key: 'telegram', label: 'تيليجرام', Icon: FaTelegramPlane, color: '#229ED9',
          href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
        { key: 'facebook', label: 'فيسبوك',   Icon: FaFacebookF,     color: '#1877F2',
          href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
        { key: 'email',    label: 'البريد',   Icon: FiMail,          color: '#6b7280',
          href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}` },
    ];

    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <>
            <div className="right-toolbar  z-[1000]">
                <button className="toolbar-btn" onClick={handleSearchToggle} title="بحث"><FiSearch /></button>
                <button className="toolbar-btn" onClick={handleLocate} title="موقعي"><FiCrosshair /></button>
                <div className="toolbar-divider tb-secondary" />
                <button className="toolbar-btn tb-secondary" onClick={handleZoomIn} title="تكبير"><FiPlus /></button>
                <button className="toolbar-btn tb-secondary" onClick={handleZoomOut} title="تصغير"><FiMinus /></button>
                <button className="toolbar-btn tb-secondary" onClick={handleFullscreen} title="ملء الشاشة">
                    {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                </button>
                <div className="toolbar-divider tb-secondary" />
                <button className="toolbar-btn tb-secondary" onClick={handleShare} title="مشاركة"><FiShare2 /></button>
                <button className="toolbar-btn" onClick={handleInfoToggle} title="معلومات"><FiInfo /></button>
                <div className="toolbar-divider tb-secondary" />
                <button className="toolbar-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'وضع النهار' : 'وضع الليل'}>
                    {darkMode ? <FiSun /> : <FiSunset />}
                </button>
                <button className="toolbar-btn" onClick={() => setSettingsOpen(true)} title="الإعدادات"><FiSettings /></button>
            </div>

            {showSearch && (
                <div className="search-panel z-[99999]">
                    <div className="search-input-wrap">
                        <FiSearch className="search-icon" />
                        <input
                            type="text" className="search-input"
                            placeholder="ابحث عن مدينة..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <button className="search-close" onClick={() => setShowSearch(false)}>×</button>
                    </div>
                    <div className="search-results">
                        {searchLoading ? (
                            <div className="search-loading"><FiLoader className="spin" /><span>البحث...</span></div>
                        ) : searchResults.length === 0 ? (
                            <div className="search-empty">لا توجد نتائج</div>
                        ) : (
                            searchResults.map((city, i) => (
                                <button
                                    key={`${city.latitude}-${city.longitude}-${i}`}
                                    className="search-result-item"
                                    onClick={() => handleSelectCity(city)}
                                >
                                    <div className="result-icon">📍</div>
                                    <div className="result-info">
                                        <div className="result-name">{city.name}</div>
                                        {city.admin1 && <div className="result-sub">{city.admin1}</div>}
                                        <div className="result-country">{city.country} ({city.country_code})</div>
                                    </div>
                                    <div className="result-coords">
                                        {city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {showInfo && (
                <div className="info-panel-overlay" onClick={() => setShowInfo(false)}>
                    <div className="info-panel-content" onClick={(e) => e.stopPropagation()}>
                        <div className="info-panel-header">
                            <h2>عن Sky Radar</h2>
                            <button className="close-btn" onClick={() => setShowInfo(false)}>×</button>
                        </div>
                        <div className="info-panel-body">
                            <div className="info-section">
                                <h3>🌍 ما هذا التطبيق؟</h3>
                                <p>منصة تفاعلية لعرض الطقس حول العالم في الوقت الحقيقي.</p>
                            </div>
                            <div className="info-section">
                                <h3>📊 مصادر البيانات</h3>
                                <ul>
                                    <li><strong>GFS</strong> - NOAA الأمريكية</li>
                                    <li><strong>ICON</strong> - DWD الألمانية</li>
                                    <li><strong>Open-Meteo API</strong> - مفتوح المصدر</li>
                                </ul>
                            </div>
                            <div className="info-section">
                                <h3>🗺️ الخريطة</h3>
                                <p>OpenStreetMap © مع محرك MapLibre GL JS</p>
                            </div>
                            <div className="info-section">
                                <h3>🕒 آخر تحديث</h3>
                                <p>{new Date().toLocaleString('ar')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showShare && (
                <div className="info-panel-overlay" onClick={() => setShowShare(false)}>
                    <div className="share-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
                        <div className="info-panel-header">
                            <h2>مشاركة الموقع</h2>
                            <button className="close-btn" onClick={() => setShowShare(false)}>×</button>
                        </div>

                        <div className="share-targets">
                            {shareTargets.map(({ key, label, Icon, color, href }) => (
                                <a
                                    key={key}
                                    className="share-target"
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setShowShare(false)}
                                >
                                    <span className="share-target-icon" style={{ background: color }}><Icon /></span>
                                    <span className="share-target-label">{label}</span>
                                </a>
                            ))}
                        </div>

                        <div className="share-link-row">
                            <input className="share-link-input" type="text" value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
                            <button className={`share-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyLink}>
                                {copied ? <><FiCheck /> تم النسخ</> : <><FiCopy /> نسخ</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
