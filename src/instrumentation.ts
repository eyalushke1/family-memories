export async function register() {
  // On Cloud Run standalone, NEXT_RUNTIME may not be set — skip only if explicitly 'edge'
  if (process.env.NEXT_RUNTIME === 'edge') return

  console.log(`[Instrumentation] register() called (NEXT_RUNTIME=${process.env.NEXT_RUNTIME ?? 'undefined'})`)
  const { startScheduler } = await import('@/lib/keepalive/scheduler')
  startScheduler()
}
