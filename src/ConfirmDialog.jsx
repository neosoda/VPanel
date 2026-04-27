/**
 Vpanel - Générateur d'étiquettes pour tableaux et armoires électriques
 Copyright (C) 2024-2026 Neosoda

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 */

'use strict'

import { useCallback, useEffect, useRef } from 'react';
import './confirmDialog.css';

/**
 * Themed confirm/alert dialog — replaces native window.confirm() and window.alert().
 *
 * Props:
 *   message    {string}         Text shown in the dialog body.
 *   onConfirm  {function}       Called when the user clicks the confirm button.
 *   onCancel   {function|null}  Called on cancel. When null the dialog acts as an alert (single OK button).
 *   confirmLabel {string}       Label for the confirm button (default "Confirmer").
 *   cancelLabel  {string}       Label for the cancel button (default "Annuler").
 *   danger     {boolean}        When true the confirm button is rendered in red.
 */
export default function ConfirmDialog({
    message,
    onConfirm,
    onCancel = null,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    danger = false,
}) {
    const confirmRef = useRef(null);

    useEffect(() => {
        confirmRef.current?.focus();
    }, []);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape' && onCancel) onCancel();
        if (e.key === 'Enter') onConfirm();
    }, [onConfirm, onCancel]);

    return (
        <div className="confirm-dialog-backdrop" onKeyDown={handleKeyDown}>
            <div className="confirm-dialog" role="dialog" aria-modal="true">
                <p className="confirm-dialog-message">{message}</p>
                <div className="confirm-dialog-actions">
                    {onCancel && (
                        <button className="confirm-dialog-btn confirm-dialog-btn--cancel" onClick={onCancel}>
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        ref={confirmRef}
                        className={`confirm-dialog-btn confirm-dialog-btn--confirm${danger ? ' confirm-dialog-btn--danger' : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
