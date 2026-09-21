import { z } from 'zod';
import { authViewSchema } from '@abhaya/validation';
import type { AuthSession } from '@abhaya/types';
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export interface TokenStore {
  read(): Promise<AuthSession | null>;
  write(session: AuthSession | null): Promise<void>;
}
export type ApiOptions = {
  baseUrl: string;
  tokens?: TokenStore;
  cookieSession?: boolean;
  onExpired?: () => void;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};
export class ApiClient {
  private refreshing: Promise<void> | null = null;
  private fetcher: typeof fetch;
  constructor(private options: ApiOptions) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  private async transport(method: string, path: string, body?: unknown, accessToken?: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 12000);
    try {
      return await this.fetcher(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        credentials: this.options.cookieSession ? 'same-origin' : 'omit',
        cache: 'no-store',
      });
    } catch (error) {
      throw new ApiError(
        'UNCONFIRMED',
        error instanceof Error && error.name === 'AbortError'
          ? 'The request timed out. Server acknowledgement was not received.'
          : 'Cannot reach ABHAYA. Check your connection. This action is not confirmed.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private async decode<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new ApiError(
        'INVALID_RESPONSE',
        'The server returned an unreadable response.',
        response.status,
      );
    }
    if (!response.ok) {
      const result = z
        .object({ error: z.object({ code: z.string(), message: z.string() }) })
        .safeParse(raw);
      throw new ApiError(
        result.success ? result.data.error.code : 'SERVICE_UNAVAILABLE',
        result.success ? result.data.error.message : 'The service is unavailable. Try again.',
        response.status,
      );
    }
    const parsed = z
      .object({ success: z.literal(true), data: z.unknown(), error: z.null() })
      .safeParse(raw);
    if (!parsed.success)
      throw new ApiError(
        'INVALID_RESPONSE',
        'The response could not be verified. Refresh before trying again.',
        response.status,
      );
    const data = schema.safeParse(parsed.data.data);
    if (!data.success)
      throw new ApiError(
        'INVALID_RESPONSE',
        'The response could not be verified. Refresh before trying again.',
        response.status,
      );
    return data.data;
  }
  private async refresh() {
    if (!this.refreshing)
      this.refreshing = (async () => {
        const old = await this.options.tokens?.read();
        if (!old && !this.options.cookieSession)
          throw new ApiError('SESSION_EXPIRED', 'Sign in to continue.', 401);
        const response = await this.transport(
          'POST',
          '/auth/refresh',
          this.options.cookieSession ? {} : { refreshToken: old!.refreshToken },
        );
        if (this.options.cookieSession)
          await this.decode(response, z.object({ user: z.unknown() }));
        else await this.options.tokens!.write(await this.decode(response, authViewSchema));
      })()
        .catch(async (error: unknown) => {
          if (error instanceof ApiError && error.status === 401) {
            await this.options.tokens?.write(null);
            this.options.onExpired?.();
          }
          throw error;
        })
        .finally(() => {
          this.refreshing = null;
        });
    return this.refreshing;
  }
  async call<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    let session = await this.options.tokens?.read();
    let response = await this.transport(method, path, body, session?.accessToken);
    if (
      response.status === 401 &&
      (!path.startsWith('/auth/') || path === '/auth/logout' || path === '/auth/verification') &&
      (session || this.options.cookieSession)
    ) {
      await this.refresh();
      session = await this.options.tokens?.read();
      response = await this.transport(method, path, body, session?.accessToken);
    }
    return this.decode(response, schema);
  }
}
