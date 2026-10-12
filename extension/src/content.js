(function() {
    const IFRAME_ID = 'tab-manager-palette-iframe';

    if (document.getElementById(IFRAME_ID)) {
        const iframe = document.getElementById(IFRAME_ID);
        if (iframe.style.display === 'none') {
            iframe.style.display = 'block';
            iframe.contentWindow.postMessage('reset-palette', '*');
            iframe.focus();
        } else {
            iframe.style.display = 'none';
        }
        return;
    }

    const browserAPI = typeof browser !== "undefined" ? browser : chrome;
    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = browserAPI.runtime.getURL('palette.html');
    
    Object.assign(iframe.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        border: 'none',
        zIndex: '2147483647',
        background: 'transparent',
        colorScheme: 'normal', // must match palette.html's root so the overlay stays transparent
        display: 'block'
    });

    document.body.appendChild(iframe);
    iframe.focus();

    // Listen for messages from the iframe to close it
    window.addEventListener('message', (event) => {
        if (event.data === 'close-palette') {
            document.getElementById(IFRAME_ID).style.display = 'none';
        }
    });

    // Fallback: Listen for Escape key on the main window (in case the iframe loses focus)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const frame = document.getElementById(IFRAME_ID);
            if (frame && frame.style.display !== 'none') {
                frame.style.display = 'none';
            }
        }
    });
})();
