/**
 Vpanel - Générateur d'étiquettes pour tableaux et armoires électriques
 Copyright (C) 2024-2026 Neosoda

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 */

'use strict'

import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[VPanel] Uncaught render error:', error, info.componentStack);
    }

    handleReset() {
        this.setState({ error: null });
        try { sessionStorage.clear(); } catch { /* ignore */ }
        window.location.reload();
    }

    render() {
        if (!this.state.error) return this.props.children;

        const msg = this.state.error?.message ?? String(this.state.error);

        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: '100vh', padding: '2rem',
                fontFamily: 'system-ui, sans-serif', gap: '1rem', textAlign: 'center'
            }}>
                <h2 style={{ color: '#c0392b', margin: 0 }}>Une erreur inattendue s&apos;est produite</h2>
                <p style={{ color: '#555', maxWidth: '480px', margin: 0 }}>
                    L&apos;application a rencontré un problème et ne peut pas continuer.
                    Vos données de session seront effacées lors du rechargement.
                </p>
                <pre style={{
                    background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px',
                    padding: '0.75rem 1rem', maxWidth: '640px', width: '100%',
                    overflowX: 'auto', fontSize: '0.8rem', textAlign: 'left', color: '#333'
                }}>{msg}</pre>
                <button
                    onClick={() => this.handleReset()}
                    style={{
                        padding: '0.6rem 1.4rem', background: '#2980b9', color: '#fff',
                        border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95rem'
                    }}
                >
                    Recharger l&apos;application
                </button>
            </div>
        );
    }
}
