export interface LogPayload {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  url?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

class StructuredLogger {
  private log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}) {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    // Standard structured logging outputs to stderr so it does not interfere with MCP stdout stdio channel
    console.error(JSON.stringify(payload));
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

export const logger = new StructuredLogger();
