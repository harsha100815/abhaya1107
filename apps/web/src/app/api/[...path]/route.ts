import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authViewSchema } from '@abhaya/validation';
export const dynamic = 'force-dynamic';
const allowed = new Set([
  'auth',
  'profile',
  'users',
  'dashboard',
  'contacts',
  'sos',
  'safety-sessions',
  'incidents',
  'location',
  'notifications',
  'config',
  'safety-map',
  'tracking',
]);
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  if (
    !segments[0] ||
    !allowed.has(segments[0]) ||
    segments.some((s) => !s || s === '.' || s === '..' || /[/\\]/.test(s))
  )
    return NextResponse.json(
      { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } },
      { status: 404 },
    );
  const mutating = !['GET', 'HEAD'].includes(req.method);
  if (
    mutating &&
    (!process.env.WEB_ORIGIN ||
      req.headers.get('origin') !== new URL(process.env.WEB_ORIGIN).origin)
  )
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'ORIGIN_FORBIDDEN', message: 'Refresh the page and try again.' },
      },
      { status: 403 },
    );
  if (!process.env.API_URL)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'CONFIGURATION', message: 'The API connection is not configured.' },
      },
      { status: 503 },
    );
  const path = '/' + segments.join('/'),
    jar = await cookies();
  let body: string | undefined;
  if (mutating) {
    body = await req.text();
    if (new TextEncoder().encode(body).length > 4500000)
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Choose an image smaller than 3 MB.' },
        },
        { status: 413 },
      );
  }
  if (path === '/auth/refresh') {
    const refreshToken = jar.get('abhaya_refresh')?.value;
    if (!refreshToken) {
      const result = NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'SESSION_EXPIRED', message: 'Sign in to continue.' },
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
      result.cookies.set('abhaya_access', '', { path: '/', maxAge: 0 });
      return result;
    }
    body = JSON.stringify({ refreshToken });
  }
  const access = jar.get('abhaya_access')?.value;
  try {
    const upstream = await fetch(
      `${process.env.API_URL.replace(/\/$/, '')}${path}${req.nextUrl.search}`,
      {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      },
    );
    const type = upstream.headers.get('content-type') ?? 'application/json';
    if (type.startsWith('image/'))
      return new NextResponse(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: {
          'Content-Type': type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    const raw: unknown = await upstream.json();
    let outgoing = raw;
    let session: ReturnType<typeof authViewSchema.parse> | undefined;
    if (upstream.ok && ['/auth/login', '/auth/register', '/auth/refresh'].includes(path)) {
      const envelope = raw as { data: unknown };
      session = authViewSchema.parse(envelope.data);
      outgoing = { success: true, data: { user: session.user }, error: null };
    }
    const result = NextResponse.json(outgoing, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
    const secure = process.env.NODE_ENV === 'production';
    if (session) {
      result.cookies.set('abhaya_access', session.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/',
        maxAge: 600,
      });
      result.cookies.set('abhaya_refresh', session.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 30 * 86400,
      });
    }
    if (
      (path === '/auth/logout' && upstream.ok) ||
      (path === '/profile' && req.method === 'DELETE' && upstream.ok) ||
      (path === '/auth/refresh' && upstream.status === 401)
    ) {
      result.cookies.set('abhaya_access', '', { path: '/', maxAge: 0 });
      result.cookies.set('abhaya_refresh', '', { path: '/api/auth', maxAge: 0 });
    }
    return result;
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'UNCONFIRMED',
          message:
            'ABHAYA could not confirm this request. Check your connection and refresh its status.',
        },
      },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
