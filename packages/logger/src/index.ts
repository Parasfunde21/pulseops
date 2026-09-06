export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function write(level: 'INFO' | 'ERROR', message: string, context?: Record<string, unknown>): void {
  const details = context === undefined ? '' : ` ${JSON.stringify(context)}`;
  console[level === 'ERROR' ? 'error' : 'info'](
    `${new Date().toISOString()} ${level} ${message}${details}`,
  );
}

export const logger: Logger = {
  info: (message, context) => write('INFO', message, context),
  error: (message, context) => write('ERROR', message, context),
};
