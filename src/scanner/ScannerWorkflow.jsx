/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useCallback } from 'react';
import './scanner.css';
import { analyzePanel, parseVoiceWithAI } from './openrouter.js';
import { validateModule, validatePanel, getRecommendedIcon, VALID_RATINGS } from './nfc15100.js';
import { parseSpeechLocal, ICON_KEYWORDS } from './speechParser.js';

const STEP = { CAPTURE: 1, ANALYSIS: 2, SCHEMA: 3, VOICE: 4, EXPORT: 5 };

const MODULE_TYPE_LABELS = {
    main: 'Général', breaker: 'Disj.', differential: 'Diff.',
    rcd: 'ID', bus: 'Bornier', empty: 'Vide', unknown: '?',
};

const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSpeech = !!SpeechAPI;
const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

function uid() { return Math.random().toString(36).slice(2, 9); }

function withIds(panel) {
    return {
        ...panel,
        rows: panel.rows.map(row => ({
            ...row,
            modules: row.modules.map(mod => ({
                ...mod,
                id: uid(),
                label: '',
                zone: '',
                iconFilename: '',
                nfcStatus: null,
                nfcMessages: [],
            })),
        })),
    };
}

function speak(text) {
    if (!hasTTS) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
}

function moduleTypeLabel(type) { return MODULE_TYPE_LABELS[type] ?? type; }

function confidenceClass(c) {
    if (c >= 0.8) return 'high';
    if (c >= 0.5) return 'mid';
    return 'low';
}

/* ── Header ────────────────────────────────────────── */

const STEP_NAMES = ['Capture', 'Analyse IA', 'Schéma', 'Saisie vocale', 'Export'];

function ScannerHeader({ step, onClose }) {
    return (
        <div className="scanner-header">
            <span className="scanner-header-logo">⚡ Vpanel</span>
            <div className="scanner-steps">
                {STEP_NAMES.map((name, i) => {
                    const s = i + 1;
                    const cls = s === step ? 'active' : s < step ? 'done' : '';
                    return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <div className={`scanner-step-dot ${cls}`} title={name} />
                            {s === step && <span className={`scanner-step-label active`}>{name}</span>}
                        </div>
                    );
                })}
            </div>
            <button className="scanner-close-btn" onClick={onClose} aria-label="Fermer le scanner" title="Fermer">
                ✕
            </button>
        </div>
    );
}

/* ── STEP 1 — Capture ──────────────────────────────── */

function StepCapture({ onCapture, error }) {
    const [preview, setPreview] = useState(null);
    const fileRef = useRef(null);

    const handleFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    return (
        <div className="scanner-step">
            <div>
                <div className="scanner-step-title">Photographiez votre tableau</div>
                <div className="scanner-step-desc">
                    Pointez l'appareil photo vers le tableau électrique ouvert. L'IA détectera chaque module automatiquement.
                </div>
            </div>

            {error && <div className="scanner-error">⚠ {error}</div>}

            {!preview ? (
                <div
                    className="scanner-capture-zone"
                    onClick={() => fileRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                    onDragOver={(e) => e.preventDefault()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                    aria-label="Prendre une photo ou importer une image"
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFile(e.target.files[0])}
                        tabIndex={-1}
                        aria-hidden="true"
                    />
                    <svg className="scanner-capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <div className="scanner-capture-text">
                        <strong>Prendre une photo</strong>
                        ou importer depuis la galerie
                    </div>
                </div>
            ) : (
                <>
                    <img src={preview} alt="Aperçu tableau" className="scanner-preview" />
                    <div className="scanner-preview-actions">
                        <button className="scanner-btn scanner-btn-secondary" onClick={() => setPreview(null)}>
                            Reprendre
                        </button>
                        <button className="scanner-btn scanner-btn-primary" onClick={() => onCapture(preview)}>
                            Analyser ↗
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

/* ── STEP 2 — Analysis ─────────────────────────────── */

const ANALYSIS_STEPS_TEXT = [
    'Envoi de la photo...',
    'Détection des rangées...',
    'Identification des modules...',
    'Lecture des calibres (OCR)...',
    'Finalisation du schéma...',
];

function StepAnalysis() {
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        const timings = [800, 2000, 3800, 5500, 7500];
        const timers = timings.map((delay, i) =>
            setTimeout(() => setActiveStep(i), delay)
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <div className="scanner-step">
            <div className="scanner-analysis-center">
                <div className="scanner-spinner" aria-hidden="true" />
                <div className="scanner-analysis-title">Analyse en cours…</div>
                <div className="scanner-analysis-steps">
                    {ANALYSIS_STEPS_TEXT.map((text, i) => {
                        const cls = i < activeStep ? 'done' : i === activeStep ? 'active' : '';
                        return (
                            <div key={i} className={`scanner-analysis-step ${cls}`}>
                                <div className="scanner-analysis-step-dot" />
                                {text}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ── STEP 3 — Schema (review + edit) ───────────────── */

const TYPE_OPTIONS = ['breaker', 'differential', 'rcd', 'main', 'bus', 'empty', 'unknown'];
const TYPE_FR = {
    breaker: 'Disjoncteur', differential: 'Disj. différentiel', rcd: 'Interrupteur différentiel',
    main: 'Disjoncteur de branchement', bus: 'Bornier / rail', empty: 'Vide', unknown: 'Inconnu',
};

function StepSchema({ panel, onUpdate, onConfirm, onRetake }) {
    const [selectedId, setSelectedId] = useState(null);

    const allModules = panel.rows.flatMap(r => r.modules);
    const totalNonEmpty = allModules.filter(m => m.type !== 'empty').length;
    const unknowns = allModules.filter(m => m.type === 'unknown').length;
    const panelWarnings = validatePanel(panel);

    const selectedMod = allModules.find(m => m.id === selectedId);

    return (
        <div className="scanner-step">
            <div>
                <div className="scanner-step-title">Vérifiez le schéma détecté</div>
                <div className="scanner-step-desc">
                    Tapez sur un module pour corriger son type ou calibre. Les modules en orange n'ont pas été identifiés.
                </div>
            </div>

            <div className="scanner-schema-stats">
                <span className="scanner-stat-badge">🔌 {totalNonEmpty} module{totalNonEmpty > 1 ? 's' : ''}</span>
                <span className="scanner-stat-badge">📋 {panel.rows.length} rangée{panel.rows.length > 1 ? 's' : ''}</span>
                {panel.brand && <span className="scanner-stat-badge">🏷 {panel.brand}</span>}
                {unknowns > 0 && <span className="scanner-stat-badge" style={{ color: '#fcd34d' }}>⚠ {unknowns} inconnu{unknowns > 1 ? 's' : ''}</span>}
            </div>

            {panelWarnings.length > 0 && (
                <div className="scanner-nfc-panel">
                    <div className="scanner-nfc-panel-title">⚡ NF C 15-100</div>
                    {panelWarnings.map((w, i) => (
                        <div key={i} className="scanner-nfc-panel-msg">• {w}</div>
                    ))}
                </div>
            )}

            <div className="scanner-schema-rows">
                {panel.rows.map((row) => (
                    <div key={row.rowIndex} className="scanner-schema-row">
                        <div className="scanner-row-label">Rangée {row.rowIndex + 1}</div>
                        <div className="scanner-modules-rail">
                            {row.modules.map((mod) => (
                                <div
                                    key={mod.id}
                                    className={`scanner-module-card ${mod.id === selectedId ? 'selected' : ''}`}
                                    data-type={mod.type}
                                    onClick={() => setSelectedId(mod.id === selectedId ? null : mod.id)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${moduleTypeLabel(mod.type)} ${mod.rating ?? '?'}A`}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedId(mod.id === selectedId ? null : mod.id)}
                                    style={{ minWidth: mod.width > 1 ? `${52 * mod.width + 4 * (mod.width - 1)}px` : undefined }}
                                >
                                    {mod.confidence != null && (
                                        <div className={`scanner-module-confidence ${confidenceClass(mod.confidence)}`} title={`Confiance : ${Math.round(mod.confidence * 100)}%`} />
                                    )}
                                    <div className="scanner-module-type">{moduleTypeLabel(mod.type)}</div>
                                    <div className="scanner-module-rating">
                                        {mod.type === 'empty' ? '—' : (mod.rating != null ? `${mod.rating}A` : '?')}
                                    </div>
                                    {mod.poles && <div className="scanner-module-poles">{mod.poles}P</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {selectedMod && (
                <div className="scanner-module-editor">
                    <div className="scanner-module-editor-title">
                        Modifier — Rangée {panel.rows.find(r => r.modules.some(m => m.id === selectedMod.id))?.rowIndex + 1}, position {selectedMod.position + 1}
                    </div>

                    <div className="scanner-editor-row">
                        <span className="scanner-editor-label">Type</span>
                        <select
                            className="scanner-editor-select"
                            value={selectedMod.type}
                            onChange={(e) => onUpdate(selectedMod.id, { type: e.target.value })}
                        >
                            {TYPE_OPTIONS.map(t => (
                                <option key={t} value={t}>{TYPE_FR[t]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="scanner-editor-row">
                        <span className="scanner-editor-label">Calibre</span>
                        <select
                            className="scanner-editor-select"
                            value={selectedMod.rating ?? ''}
                            onChange={(e) => onUpdate(selectedMod.id, { rating: e.target.value ? parseInt(e.target.value) : null })}
                        >
                            <option value="">Inconnu</option>
                            {VALID_RATINGS.map(r => <option key={r} value={r}>{r}A</option>)}
                        </select>
                    </div>

                    <div className="scanner-editor-row">
                        <span className="scanner-editor-label">Pôles</span>
                        <select
                            className="scanner-editor-select"
                            value={selectedMod.poles ?? ''}
                            onChange={(e) => onUpdate(selectedMod.id, { poles: e.target.value ? parseInt(e.target.value) : null })}
                        >
                            <option value="">Inconnu</option>
                            <option value={1}>1P (1P+N)</option>
                            <option value={2}>2P</option>
                            <option value={3}>3P</option>
                            <option value={4}>4P (3P+N)</option>
                        </select>
                    </div>

                    <button
                        className="scanner-btn scanner-btn-secondary"
                        style={{ marginTop: '0.25rem' }}
                        onClick={() => setSelectedId(null)}
                    >
                        Fermer
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="scanner-btn scanner-btn-secondary" onClick={onRetake} style={{ flex: '0 0 auto' }}>
                    Reprendre photo
                </button>
                <button className="scanner-btn scanner-btn-primary scanner-btn-full" onClick={onConfirm}>
                    Confirmer · Saisie vocale →
                </button>
            </div>
        </div>
    );
}

/* ── STEP 4 — Voice ────────────────────────────────── */

function StepVoice({ modules, currentIndex, onUpdate, onNext, onPrev, onDone }) {
    const [transcript, setTranscript] = useState('');
    const [listening, setListening] = useState(false);
    const [processing, setProcessing] = useState(false);
    const recognitionRef = useRef(null);
    const inputRef = useRef(null);

    const mod = modules[currentIndex];

    const announceCurrent = useCallback(() => {
        if (!hasTTS || !mod) return;
        const typeStr = TYPE_FR[mod.type] ?? mod.type;
        const ratingStr = mod.rating ? `${mod.rating} ampères` : '';
        const circuitStr = mod.label ? `Circuit : ${mod.label}.` : 'Dites le nom du circuit.';
        speak(`Module ${currentIndex + 1} sur ${modules.length}. ${typeStr} ${ratingStr}. ${circuitStr}`);
    }, [mod, currentIndex, modules.length]);

    useEffect(() => {
        announceCurrent();
        setTranscript('');
        if (inputRef.current) inputRef.current.value = mod?.label || '';
    }, [currentIndex, announceCurrent, mod?.label]);

    const applyParsed = useCallback(async (text) => {
        setProcessing(true);
        try {
            let parsed = parseSpeechLocal(text);

            // If local parser gets command, handle immediately
            if (parsed.command === 'next') { onNext(); return; }
            if (parsed.command === 'previous') { onPrev(); return; }
            if (parsed.command === 'done') { onDone(); return; }

            // If label is unclear, try AI parsing
            if (!parsed.label && !parsed.zone && !parsed.rating) {
                const aiParsed = await parseVoiceWithAI(text, {
                    type: mod.type, rating: mod.rating, currentLabel: mod.label
                }).catch(() => null);
                if (aiParsed) {
                    if (aiParsed.command === 'next') { onNext(); return; }
                    if (aiParsed.command === 'previous') { onPrev(); return; }
                    if (aiParsed.command === 'done') { onDone(); return; }
                    parsed = {
                        label: aiParsed.label ?? parsed.label,
                        zone: aiParsed.zone ?? parsed.zone,
                        rating: aiParsed.rating ?? parsed.rating,
                        iconFilename: aiParsed.iconKeyword
                            ? (ICON_KEYWORDS[aiParsed.iconKeyword] ?? getRecommendedIcon(aiParsed.label ?? '', aiParsed.zone ?? ''))
                            : parsed.iconFilename,
                    };
                }
            }

            const updates = {};
            if (parsed.label) updates.label = parsed.label;
            if (parsed.zone) updates.zone = parsed.zone;
            if (parsed.rating) updates.rating = parsed.rating;
            if (parsed.iconFilename) updates.iconFilename = parsed.iconFilename;

            if (!updates.iconFilename && (updates.label || updates.zone)) {
                updates.iconFilename = getRecommendedIcon(updates.label ?? mod.label, updates.zone ?? mod.zone);
            }

            if (Object.keys(updates).length > 0) {
                const validation = validateModule({ ...mod, ...updates });
                updates.nfcStatus = validation.status;
                updates.nfcMessages = validation.messages;
                onUpdate(mod.id, updates);
                if (inputRef.current) inputRef.current.value = updates.label ?? mod.label ?? '';
            }
        } finally {
            setProcessing(false);
        }
    }, [mod, onNext, onPrev, onDone, onUpdate]);

    const startListening = useCallback(() => {
        if (!hasSpeech || listening) return;
        const rec = new SpeechAPI();
        rec.lang = 'fr-FR';
        rec.continuous = false;
        rec.interimResults = true;

        rec.onstart = () => setListening(true);
        rec.onend = () => setListening(false);
        rec.onerror = () => setListening(false);

        rec.onresult = (e) => {
            const text = Array.from(e.results)
                .map(r => r[0].transcript)
                .join('');
            setTranscript(text);
            if (e.results[e.results.length - 1].isFinal) {
                applyParsed(text);
            }
        };

        recognitionRef.current = rec;
        rec.start();
    }, [hasSpeech, listening, applyParsed]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setListening(false);
    }, []);

    const handleManualInput = useCallback((e) => {
        if (e.key === 'Enter') {
            const val = e.currentTarget.value.trim();
            if (val) applyParsed(val);
        }
    }, [applyParsed]);

    if (!mod) return null;

    const nfcStatus = mod.nfcStatus;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="scanner-step" style={{ flex: 1 }}>

                {/* Progress */}
                <div className="scanner-voice-progress">
                    <div className="scanner-voice-progress-bar">
                        <div
                            className="scanner-voice-progress-fill"
                            style={{ width: `${((currentIndex + 1) / modules.length) * 100}%` }}
                        />
                    </div>
                    <span className="scanner-voice-progress-text">
                        {currentIndex + 1}&nbsp;/&nbsp;{modules.length}
                    </span>
                </div>

                {/* Module hero card */}
                <div className="scanner-module-hero">
                    <div className="scanner-module-hero-header">
                        <div className="scanner-module-hero-type-badge" data-type={mod.type}>
                            {TYPE_FR[mod.type] ?? mod.type}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <div className="scanner-module-hero-rating">
                            {mod.rating != null ? `${mod.rating}A` : '?A'}
                        </div>
                        {mod.poles && (
                            <div className="scanner-module-hero-sub">{mod.poles}P</div>
                        )}
                        {mod.zone && (
                            <div className="scanner-module-hero-sub" style={{ marginLeft: 'auto', color: '#2dd4bf' }}>
                                {mod.zone}
                            </div>
                        )}
                    </div>

                    {nfcStatus && (
                        <div className="scanner-module-hero-nfc">
                            {mod.nfcMessages.slice(0, 2).map((msg, i) => (
                                <div key={i} className={`scanner-nfc-badge ${nfcStatus}`}>
                                    {nfcStatus === 'ok' ? '✓' : '⚡'} {msg}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Label input */}
                <div className="scanner-label-input-group">
                    <div className="scanner-label-input-label">Nom du circuit</div>
                    <input
                        ref={inputRef}
                        type="text"
                        className="scanner-label-input"
                        placeholder="Ex : Prises salon, Lumière cuisine…"
                        defaultValue={mod.label}
                        onKeyDown={handleManualInput}
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== mod.label) applyParsed(v);
                        }}
                        aria-label="Nom du circuit"
                    />
                </div>

                {/* Microphone */}
                <div className="scanner-mic-zone">
                    {hasSpeech ? (
                        <button
                            className={`scanner-mic-btn ${listening ? 'listening' : ''}`}
                            onClick={listening ? stopListening : startListening}
                            aria-label={listening ? 'Arrêter la dictée' : 'Dicter le nom du circuit'}
                            disabled={processing}
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="2" width="6" height="11" rx="3"/>
                                <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8"/>
                            </svg>
                        </button>
                    ) : (
                        <div className="scanner-mic-label" style={{ color: '#fca5a5' }}>
                            Dictée non disponible sur ce navigateur
                        </div>
                    )}
                    <div className={`scanner-mic-label ${listening ? 'listening' : ''}`}>
                        {processing ? 'Traitement…' : listening ? 'En écoute…' : hasSpeech ? 'Appuyer pour dicter' : ''}
                    </div>
                    {(transcript || processing) && (
                        <div className="scanner-transcript">
                            {processing ? '⏳ Analyse…' : transcript}
                        </div>
                    )}
                </div>

            </div>

            {/* Navigation sticky bottom */}
            <div className="scanner-voice-nav">
                <button
                    className="scanner-btn scanner-btn-secondary"
                    onClick={onPrev}
                    disabled={currentIndex === 0}
                    style={{ justifySelf: 'start' }}
                    aria-label="Module précédent"
                >
                    ← Préc.
                </button>

                <div className="scanner-voice-nav-center">
                    <div className="scanner-voice-nav-pos">
                        Module {currentIndex + 1} sur {modules.length}
                    </div>
                    <button
                        className="scanner-btn scanner-btn-danger"
                        style={{ minHeight: '36px', fontSize: '0.8125rem' }}
                        onClick={onDone}
                    >
                        Terminer
                    </button>
                </div>

                <button
                    className="scanner-btn scanner-btn-primary"
                    onClick={currentIndex < modules.length - 1 ? onNext : onDone}
                    style={{ justifySelf: 'end' }}
                    aria-label={currentIndex < modules.length - 1 ? 'Module suivant' : 'Terminer la saisie'}
                >
                    {currentIndex < modules.length - 1 ? 'Suiv. →' : 'Terminer ✓'}
                </button>
            </div>
        </div>
    );
}

/* ── STEP 5 — Export ───────────────────────────────── */

function printLabels(modules) {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = modules.filter(m => m.type !== 'empty');
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>Étiquettes tableau — Vpanel</title>
<style>
*{box-sizing:border-box;}
@page{size:A4;margin:10mm;}
body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#111;}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;}
.label{border:1px solid #bbb;border-radius:3mm;padding:3mm 4mm;min-height:28mm;display:flex;flex-direction:column;gap:1.5mm;break-inside:avoid;}
.label-header{display:flex;align-items:center;justify-content:space-between;gap:2mm;}
.label-name{font-size:8.5pt;font-weight:bold;line-height:1.2;flex:1;}
.label-badge{font-size:6pt;font-weight:700;background:#008b8b;color:#fff;border-radius:2mm;padding:0.5mm 2mm;white-space:nowrap;flex-shrink:0;}
.label-zone{font-size:6.5pt;color:#666;}
.label-footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;border-top:0.5px solid #ddd;padding-top:1.5mm;}
.label-info{font-size:6.5pt;color:#333;}
.label-nfc{font-size:5.5pt;color:#008b8b;font-weight:600;}
.page-title{font-size:8pt;color:#999;margin-bottom:4mm;text-align:right;}
</style></head>
<body>
<div class="page-title">Vpanel Scanner — Tableau électrique | ${new Date().toLocaleDateString('fr-FR')}</div>
<div class="grid">
${rows.map(m => {
        const type = { breaker: 'Disj.', differential: 'Diff.', rcd: 'ID', main: 'Gén.', unknown: '?' }[m.type] ?? m.type;
        const nfcOk = m.nfcStatus === 'ok' || !m.nfcStatus;
        return `<div class="label">
<div class="label-header">
  <div class="label-name">${m.label || `Circuit ${m.position + 1}`}</div>
  <div class="label-badge">${type} ${m.rating ?? '?'}A</div>
</div>
${m.zone ? `<div class="label-zone">${m.zone}</div>` : ''}
<div class="label-footer">
  <div class="label-info">${m.poles ? `${m.poles}P` : ''}</div>
  <div class="label-nfc">${nfcOk ? '✓ NF C 15-100' : '⚠ Vérifier'}</div>
</div>
</div>`;
    }).join('\n')}
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    win.document.close();
}

function printSchema(panel) {
    const win = window.open('', '_blank');
    if (!win) return;
    const typeColors = {
        main: '#1e40af', breaker: '#0d9488', differential: '#7c3aed',
        rcd: '#d97706', bus: '#374151', empty: '#e5e7eb', unknown: '#b45309',
    };
    const typeText = { main: 'GÉNÉRAL', breaker: 'DISJ.', differential: 'DIFF.', rcd: 'ID', bus: 'BORNR', empty: '', unknown: '?' };
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>Schéma électrique — Vpanel</title>
<style>
*{box-sizing:border-box;}
@page{size:A4 landscape;margin:10mm;}
body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#111;font-size:8pt;}
h1{font-size:11pt;margin:0 0 4mm;font-weight:700;}
h2{font-size:8pt;color:#666;margin:0 0 6mm;font-weight:400;}
.row-block{margin-bottom:6mm;break-inside:avoid;}
.row-label{font-size:6.5pt;font-weight:700;color:#666;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:2mm;}
.rail{display:flex;flex-direction:row;flex-wrap:nowrap;gap:2mm;background:#f3f4f6;border:1px solid #ddd;border-radius:4mm;padding:3mm;}
.module{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:2mm;min-height:18mm;min-width:14mm;padding:1.5mm;border:1px solid rgba(0,0,0,0.1);text-align:center;gap:0.5mm;}
.mod-type{font-size:5pt;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.04em;text-transform:uppercase;line-height:1;}
.mod-rating{font-size:9pt;font-weight:900;color:#fff;line-height:1;letter-spacing:-0.02em;}
.mod-label{font-size:5pt;color:rgba(255,255,255,0.75);line-height:1.2;max-width:30mm;word-break:break-word;text-align:center;}
.mod-zone{font-size:4.5pt;color:rgba(255,255,255,0.5);}
.legend{margin-top:6mm;display:flex;gap:4mm;flex-wrap:wrap;}
.legend-item{display:flex;align-items:center;gap:1.5mm;font-size:6pt;}
.legend-dot{width:8px;height:8px;border-radius:1.5mm;flex-shrink:0;}
.footer{margin-top:8mm;font-size:6pt;color:#999;border-top:0.5px solid #ddd;padding-top:2mm;display:flex;justify-content:space-between;}
</style></head>
<body>
<h1>⚡ Schéma électrique — Tableau ${panel.brand ?? ''}</h1>
<h2>Généré par Vpanel Scanner · ${new Date().toLocaleDateString('fr-FR')} · Norme NF C 15-100</h2>
${panel.rows.map(row => `
<div class="row-block">
  <div class="row-label">Rangée ${row.rowIndex + 1}</div>
  <div class="rail">
    ${row.modules.map(m => {
        const color = typeColors[m.type] ?? '#374151';
        return `<div class="module" style="background:${color};min-width:${14 * (m.width || 1) + 2 * (m.width - 1)}mm;">
<div class="mod-type">${typeText[m.type] ?? m.type}</div>
<div class="mod-rating">${m.rating ?? '?'}A</div>
${m.label ? `<div class="mod-label">${m.label}</div>` : ''}
${m.zone ? `<div class="mod-zone">${m.zone}</div>` : ''}
</div>`;
    }).join('\n')}
  </div>
</div>`).join('\n')}
<div class="legend">
  ${Object.entries(typeColors).map(([t, c]) => `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${TYPE_FR[t] ?? t}</div>`).join('')}
</div>
<div class="footer">
  <span>Vpanel Scanner — vpanel.fr</span>
  <span>NF C 15-100 — Installations électriques basse tension</span>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    win.document.close();
}

function StepExport({ panel, flatModules }) {
    const labeled = flatModules.filter(m => m.label && m.type !== 'empty');
    const unlabeled = flatModules.filter(m => !m.label && m.type !== 'empty');
    const warnings = flatModules.filter(m => m.nfcStatus === 'warning').length;
    const errors = flatModules.filter(m => m.nfcStatus === 'error').length;
    const panelWarnings = validatePanel(panel);

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify(panel, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `tableau_electrique_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="scanner-step">
            <div>
                <div className="scanner-step-title">Génération des documents</div>
                <div className="scanner-step-desc">
                    Tous les livrables sont générés localement et imprimés directement depuis le navigateur.
                </div>
            </div>

            <div className="scanner-export-summary">
                <div className="scanner-export-stat">
                    <span className="scanner-export-stat-label">Modules saisis</span>
                    <span className="scanner-export-stat-value">{labeled.length} / {flatModules.length}</span>
                </div>
                <div className="scanner-export-stat">
                    <span className="scanner-export-stat-label">Non nommés</span>
                    <span className="scanner-export-stat-value" style={unlabeled.length ? { color: '#fcd34d' } : {}}>
                        {unlabeled.length}
                    </span>
                </div>
                {warnings > 0 && (
                    <div className="scanner-export-stat">
                        <span className="scanner-export-stat-label">Alertes NF C 15-100</span>
                        <span className="scanner-export-stat-value" style={{ color: '#fde047' }}>⚡ {warnings}</span>
                    </div>
                )}
                {errors > 0 && (
                    <div className="scanner-export-stat">
                        <span className="scanner-export-stat-label">Non-conformités</span>
                        <span className="scanner-export-stat-value" style={{ color: '#fca5a5' }}>⚠ {errors}</span>
                    </div>
                )}
                {panelWarnings.map((w, i) => (
                    <div key={i} className="scanner-export-stat">
                        <span className="scanner-export-stat-label" style={{ color: '#fde047' }}>⚡ {w}</span>
                    </div>
                ))}
            </div>

            <div className="scanner-export-actions">
                <button className="scanner-export-btn" onClick={() => printLabels(flatModules)}>
                    <div className="scanner-export-btn-icon labels">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                        </svg>
                    </div>
                    <div className="scanner-export-btn-text">
                        <span className="scanner-export-btn-title">Étiquettes PDF</span>
                        <span className="scanner-export-btn-sub">Impression A4 · {flatModules.filter(m => m.type !== 'empty').length} étiquettes</span>
                    </div>
                </button>

                <button className="scanner-export-btn" onClick={() => printSchema(panel)}>
                    <div className="scanner-export-btn-icon schema">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                    </div>
                    <div className="scanner-export-btn-text">
                        <span className="scanner-export-btn-title">Schéma électrique PDF</span>
                        <span className="scanner-export-btn-sub">Paysage A4 · Toutes les rangées</span>
                    </div>
                </button>

                <button className="scanner-export-btn" onClick={exportJSON}>
                    <div className="scanner-export-btn-icon json">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                    </div>
                    <div className="scanner-export-btn-text">
                        <span className="scanner-export-btn-title">Exporter JSON</span>
                        <span className="scanner-export-btn-sub">Sauvegarde locale · Rechargeable hors-ligne</span>
                    </div>
                </button>
            </div>
        </div>
    );
}

/* ── Main orchestrator ──────────────────────────────── */

export default function ScannerWorkflow({ onClose }) {
    const [step, setStep] = useState(STEP.CAPTURE);
    const [image, setImage] = useState(null);
    const [panel, setPanel] = useState(null);
    const [error, setError] = useState(null);
    const [voiceIndex, setVoiceIndex] = useState(0);

    // Restore from localStorage if available
    useEffect(() => {
        try {
            const saved = localStorage.getItem('vpanel_scanner_state');
            if (saved) {
                const { step: s, panel: p, voiceIndex: vi } = JSON.parse(saved);
                if (p && s >= STEP.SCHEMA) {
                    setPanel(p);
                    setStep(s);
                    setVoiceIndex(vi ?? 0);
                }
            }
        } catch {}
    }, []);

    useEffect(() => {
        if (panel) {
            try {
                localStorage.setItem('vpanel_scanner_state', JSON.stringify({ step, panel, voiceIndex }));
            } catch {}
        }
    }, [step, panel, voiceIndex]);

    const flatModules = panel
        ? panel.rows.flatMap(r => r.modules.filter(m => m.type !== 'empty'))
        : [];

    const handleCapture = (imageBase64) => {
        setImage(imageBase64);
        setError(null);
        setStep(STEP.ANALYSIS);
        analyzePanel(imageBase64)
            .then(detected => {
                setPanel(withIds(detected));
                setStep(STEP.SCHEMA);
            })
            .catch(err => {
                setError(`Analyse IA échouée : ${err.message}. Vérifiez votre connexion et réessayez.`);
                setStep(STEP.CAPTURE);
            });
    };

    const updateModule = useCallback((id, updates) => {
        setPanel(p => ({
            ...p,
            rows: p.rows.map(r => ({
                ...r,
                modules: r.modules.map(m => m.id === id ? { ...m, ...updates } : m),
            })),
        }));
    }, []);

    const handleClose = () => {
        window.speechSynthesis?.cancel();
        onClose();
    };

    return (
        <div
            className="scanner-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Scanner de tableau électrique Vpanel"
        >
            <ScannerHeader step={step} onClose={handleClose} />

            <div className="scanner-content">
                {step === STEP.CAPTURE && (
                    <StepCapture onCapture={handleCapture} error={error} />
                )}
                {step === STEP.ANALYSIS && (
                    <StepAnalysis image={image} />
                )}
                {step === STEP.SCHEMA && panel && (
                    <StepSchema
                        panel={panel}
                        onUpdate={updateModule}
                        onConfirm={() => { setVoiceIndex(0); setStep(STEP.VOICE); }}
                        onRetake={() => { setPanel(null); setStep(STEP.CAPTURE); }}
                    />
                )}
                {step === STEP.VOICE && panel && (
                    <StepVoice
                        modules={flatModules}
                        currentIndex={voiceIndex}
                        onUpdate={updateModule}
                        onNext={() => {
                            if (voiceIndex < flatModules.length - 1) setVoiceIndex(i => i + 1);
                            else setStep(STEP.EXPORT);
                        }}
                        onPrev={() => setVoiceIndex(i => Math.max(0, i - 1))}
                        onDone={() => setStep(STEP.EXPORT)}
                    />
                )}
                {step === STEP.EXPORT && panel && (
                    <StepExport panel={panel} flatModules={flatModules} />
                )}
            </div>
        </div>
    );
}
