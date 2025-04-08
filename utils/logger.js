export function logEvent(event, data) {
    const logData = {
      event,
      data,
      timestamp: new Date().toISOString(),
      ip: '', // можно получить с сервера, если требуется
      file: 'Messages.jsx'
    };
    console.log('[LOG]', logData);
    // Можно отправить лог на сервер
    // fetch('/api/log', { method: 'POST', body: JSON.stringify(logData) });
  }