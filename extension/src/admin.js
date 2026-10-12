const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const container = document.getElementById('logs-container');

function renderLogs() {
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    browserAPI.storage.local.get(['agent_logs'], (res) => {
        const logs = res.agent_logs || [];
        container.innerHTML = '';
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty">No activity yet. TabFlow logs what it does here, for example when it closes a duplicate tab.</div>';
            return;
        }

        const filteredLogs = logs.filter(log => {
            if (!searchVal) return true;
            const fullText = (log.type + ' ' + log.action + ' ' + log.status + ' ' + log.details).toLowerCase();
            return fullText.includes(searchVal);
        });

        if (filteredLogs.length === 0) {
            container.innerHTML = '<div class="empty">No matching logs found.</div>';
            return;
        }

        filteredLogs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            
            const time = new Date(log.timestamp).toLocaleTimeString();
            const typeClass = log.status === 'error' ? 'type-error' : (log.status === 'success' ? 'type-success' : 'type-pending');
            
            const headerDiv = document.createElement('div');
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'log-time';
            timeSpan.textContent = `[${time}] `;
            
            const typeSpan = document.createElement('span');
            typeSpan.className = `log-type ${typeClass}`;
            typeSpan.textContent = `${log.status.toUpperCase()} `;
            
            const titleStrong = document.createElement('strong');
            titleStrong.textContent = `${log.type} - ${log.action}`;
            
            headerDiv.appendChild(timeSpan);
            headerDiv.appendChild(typeSpan);
            headerDiv.appendChild(titleStrong);
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'log-details';
            detailsDiv.textContent = log.details;
            
            div.appendChild(headerDiv);
            div.appendChild(detailsDiv);
            container.appendChild(div);
        });
    });
}

document.getElementById('search-input').addEventListener('input', renderLogs);
document.getElementById('btn-refresh').addEventListener('click', renderLogs);
document.getElementById('btn-clear').addEventListener('click', () => {
    browserAPI.storage.local.remove('agent_logs', () => {
        renderLogs();
    });
});

renderLogs();
