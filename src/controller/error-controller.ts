import { Events } from '../events';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { ErrorData } from '../types/events';

export default class ErrorController {
  private readonly hls: Hls;
  private log: (msg: any) => void;
  private warn: (msg: any) => void;
  private error: (msg: any) => void;

  constructor(hls: Hls) {
    this.hls = hls;
    this.log = logger.log.bind(logger, `[info]:`);
    this.warn = logger.warn.bind(logger, `[warning]:`);
    this.error = logger.error.bind(logger, `[error]:`);
    this.registerListeners();
  }

  private registerListeners() {
    this.hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    this.hls.off(Events.ERROR, this.onError, this);
    this.hls.off(Events.ERROR, this.onErrorOut, this);
  }

  destroy() {
    this.unregisterListeners();
    // @ts-ignore
    this.hls = null;
  }

  private onError(event: Events.ERROR, data: ErrorData) {}

  public onErrorOut(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      this.hls.stopLoad();
    }
  }
}
