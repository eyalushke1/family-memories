import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data },
    { status }
  )
}

export function errorResponse(error: string, status = 500) {
  return NextResponse.json<ApiResponse>(
    { success: false, error },
    { status }
  )
}
