/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 */

"use strict";

var EventLogger = (function () {
    var _urlParams = new URLSearchParams(window.location.search);
    var _enabled = _urlParams.get('eventLog') === 'true';

    var _sessionMetadata = null;
    var _currentTrialEvents = [];
    var _trials = [];
    var _trialStartTimestamp = null;
    var _currentTrialId = null;
    var _lastDownloadedAt = null;

    // Per-trial state flags, reset by startTrial()
    var _isInTarget = false;
    var _isInZoomTarget = false;

    // Cursor trace state
    var _cursorHz = (function () {
        var raw = parseFloat(_urlParams.get('cursorHz'));
        if (isNaN(raw) || raw <= 0 || raw > 240) return 60;
        return Math.max(1, Math.min(240, raw));
    })();
    var _cursorTraceInterval = 1000 / _cursorHz;
    var _GAP_THRESHOLD_MS = 100;

    var _latestCursorPos = null;
    var _cursorTrace = [];
    var _cursorTraceRafId = null;
    var _lastRecordedCursor = null;
    var _cursorTraceStart = null;
    var _lastRecordedTime = 0;
    var _lastRafTimestamp = null;
    var _cursorTraceTargetSvgRect = null;

    function _createDownloadButton() {
        var btn = document.createElement('button');
        btn.id = 'download-log-btn';
        btn.textContent = 'Download Log';
        btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:8px 16px;font-size:14px;display:none;cursor:pointer;';
        btn.addEventListener('click', function () {
            downloadLog();
        });
        document.body.appendChild(btn);
        if (_enabled) {
            btn.style.display = 'block';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _createDownloadButton);
    } else {
        _createDownloadButton();
    }

    function isEnabled() {
        return _enabled;
    }

    function startSession(metadata) {
        if (!_enabled) return;
        var now = Date.now();
        _sessionMetadata = {
            participantId: metadata.participantId || '',
            trialType: metadata.trialType || '',
            sessionId: metadata.sessionId || '',
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            sessionStartTimestamp: now,
            sessionStartIso: new Date(now).toISOString()
        };
        _currentTrialEvents = [];
        _trials = [];
        _trialStartTimestamp = null;
        _currentTrialId = null;
        _lastDownloadedAt = null;
        _isInTarget = false;
        _isInZoomTarget = false;
        console.debug('[EventLogger] Session started', _sessionMetadata);
    }

    function startTrial(trialId) {
        if (!_enabled) return;
        _currentTrialId = trialId;
        _currentTrialEvents = [];
        _trialStartTimestamp = Date.now();
        _isInTarget = false;
        _isInZoomTarget = false;
        console.debug('[EventLogger] Trial started', trialId);
    }

    function logEvent(type, data) {
        if (!_enabled) return;
        var now = Date.now();
        var entry = {
            type: type,
            timestamp: now,
            timestampIso: new Date(now).toISOString(),
            timeSinceTrialStartMs: _trialStartTimestamp != null ? now - _trialStartTimestamp : null
        };
        if (data) {
            var keys = Object.keys(data);
            for (var i = 0; i < keys.length; i++) {
                entry[keys[i]] = data[keys[i]];
            }
        }
        _currentTrialEvents.push(entry);
        console.debug('[EventLogger]', type, data || '');
    }

    function endTrial(trialMetadata) {
        if (!_enabled) return;
        var trial = {
            trialId: _currentTrialId,
            startTimestamp: _trialStartTimestamp,
            endTimestamp: Date.now(),
            trialMetrics: trialMetadata || {},
            events: _currentTrialEvents.slice()
        };
        _trials.push(trial);
        _currentTrialEvents = [];
        _trialStartTimestamp = null;
        console.debug('[EventLogger] Trial ended', trial.trialId);
    }

    function getDownloadPayload() {
        return {
            metadata: _sessionMetadata,
            trials: _trials.slice()
        };
    }

    function _generateFilename() {
        var pid = (_sessionMetadata && _sessionMetadata.participantId) || 'unknown';
        var ttype = (_sessionMetadata && _sessionMetadata.trialType) || 'unknown';
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        return pid + '_' + ttype + '_' + ts + '.json';
    }

    function _showFallbackModal(payload) {
        var overlay = document.createElement('div');
        overlay.id = 'event-logger-modal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;padding:32px;border-radius:8px;text-align:center;max-width:400px;';
        box.innerHTML = '<h3 style="margin:0 0 12px;">Your results are ready</h3><p style="margin:0 0 20px;">Auto-download was blocked by your browser. Click below to save.</p>';
        var btn = document.createElement('button');
        btn.textContent = 'Save Results';
        btn.style.cssText = 'padding:10px 24px;font-size:16px;cursor:pointer;';
        btn.addEventListener('click', function () {
            _triggerDownload(payload);
            document.body.removeChild(overlay);
        });
        box.appendChild(btn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    function _triggerDownload(payload) {
        var json = JSON.stringify(payload, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = _generateFilename();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        _lastDownloadedAt = Date.now();
    }

    function downloadLog() {
        if (!_enabled) return;
        if (_trials.length === 0 && _currentTrialEvents.length === 0) return;
        var payload = getDownloadPayload();
        try {
            _triggerDownload(payload);
        } catch (e) {
            _showFallbackModal(payload);
        }
    }

    function clearLog() {
        _trials = [];
        _currentTrialEvents = [];
        _lastDownloadedAt = null;
    }

    // Expose per-trial state getters/setters for instrumentation code
    function getIsInTarget() { return _isInTarget; }
    function setIsInTarget(v) { _isInTarget = v; }
    function getIsInZoomTarget() { return _isInZoomTarget; }
    function setIsInZoomTarget(v) { _isInZoomTarget = v; }

    function updateCursorPosition(x, y) {
        if (!_enabled) return;
        _latestCursorPos = { x: x, y: y };
    }

    function startCursorTrace(svgElement) {
        if (!_enabled) return;
        cancelAnimationFrame(_cursorTraceRafId);
        _cursorTrace = [];
        _lastRecordedTime = 0;
        _lastRecordedCursor = null;
        _latestCursorPos = null;
        _lastRafTimestamp = null;
        _cursorTraceStart = Date.now();
_cursorTraceTargetSvgRect = null;
        if (svgElement) {
            var rect = svgElement.getBoundingClientRect();
            _cursorTraceTargetSvgRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, left: rect.left };
        }

        function rafLoop(timestamp) {
            var rafDelta = null;
            if (_lastRafTimestamp !== null) {
                rafDelta = timestamp - _lastRafTimestamp;
            }
            _lastRafTimestamp = timestamp;

            var now = performance.now();
            if (_lastRecordedTime > 0 && (now - _lastRecordedTime) < _cursorTraceInterval) {
                _cursorTraceRafId = requestAnimationFrame(rafLoop);
                return;
            }

            if (rafDelta !== null && rafDelta > _GAP_THRESHOLD_MS) {
                _cursorTrace.push({ t: Date.now(), x: null, y: null, marker: 'trace_resumed' });
            }

            if (_latestCursorPos === null) {
                _cursorTraceRafId = requestAnimationFrame(rafLoop);
                return;
            }

            if (_lastRecordedCursor && _latestCursorPos.x === _lastRecordedCursor.x && _latestCursorPos.y === _lastRecordedCursor.y) {
                _cursorTraceRafId = requestAnimationFrame(rafLoop);
                return;
            }

            _cursorTrace.push({ t: Date.now(), x: _latestCursorPos.x, y: _latestCursorPos.y });
            _lastRecordedTime = now;
            _lastRecordedCursor = { x: _latestCursorPos.x, y: _latestCursorPos.y };
            _cursorTraceRafId = requestAnimationFrame(rafLoop);
        }

        _cursorTraceRafId = requestAnimationFrame(rafLoop);
        console.debug('[EventLogger] Cursor trace started at ' + _cursorHz + 'Hz');
    }

    function stopCursorTrace() {
        if (!_enabled) return;
        cancelAnimationFrame(_cursorTraceRafId);
        _cursorTraceRafId = null;
        console.debug('[EventLogger] Cursor trace stopped, ' + _cursorTrace.length + ' samples');
    }

    function downloadCursorTrace(metadata) {
        if (!_enabled) return;
        if (_cursorTrace.length === 0) return;
        var payload = {
            metadata: {
                participantId: (_sessionMetadata && _sessionMetadata.participantId) || '',
                trialType: (_sessionMetadata && _sessionMetadata.trialType) || '',
                sessionId: (_sessionMetadata && _sessionMetadata.sessionId) || '',
                trialNum: metadata && metadata.trialNum,
                condition: metadata && metadata.condition,
                samplingHz: _cursorHz,
                traceStart: _cursorTraceStart,
                targetSvgBoundingRect: _cursorTraceTargetSvgRect,
                userAgent: navigator.userAgent,
                platform: navigator.platform
            },
            cursorTrace: _cursorTrace.slice()
        };
        var pid = payload.metadata.participantId || 'unknown';
        var tNum = (metadata && metadata.trialNum) || 0;
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var filename = pid + '_fitts_cursor_trial' + tNum + '_' + ts + '.json';
        var json = JSON.stringify(payload, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.debug('[EventLogger] Cursor trace downloaded: ' + filename);
    }

    function clearCursorTrace() {
        if (!_enabled) return;
        _cursorTrace = [];
    }

    return {
        isEnabled: isEnabled,
        startSession: startSession,
        startTrial: startTrial,
        logEvent: logEvent,
        endTrial: endTrial,
        getDownloadPayload: getDownloadPayload,
        downloadLog: downloadLog,
        clearLog: clearLog,
        get lastDownloadedAt() { return _lastDownloadedAt; },
        getIsInTarget: getIsInTarget,
        setIsInTarget: setIsInTarget,
        getIsInZoomTarget: getIsInZoomTarget,
        setIsInZoomTarget: setIsInZoomTarget,
        startCursorTrace: startCursorTrace,
        stopCursorTrace: stopCursorTrace,
        updateCursorPosition: updateCursorPosition,
        downloadCursorTrace: downloadCursorTrace,
        clearCursorTrace: clearCursorTrace
    };
})();
