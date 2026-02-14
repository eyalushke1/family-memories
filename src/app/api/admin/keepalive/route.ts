import { NextRequest } from 'next/server'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { listProjects, addProject } from '@/lib/keepalive/db'

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  try {
    const projects = await listProjects()
    return successResponse(projects)
  } catch (e) {
    console.error('Failed to list keepalive projects:', e)
    return errorResponse(e instanceof Error ? e.message : 'Failed to list projects')
  }
}

export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  try {
    const body = await request.json()
    const name = body.name?.trim()
    const supabaseUrl = body.supabase_url?.trim()
    const serviceKey = body.service_key?.trim()

    if (!name) return errorResponse('Name is required', 400)
    if (!supabaseUrl) return errorResponse('Supabase URL is required', 400)
    if (!serviceKey) return errorResponse('Service key is required', 400)

    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      return errorResponse('Invalid Supabase URL. Must be https://<project>.supabase.co', 400)
    }

    const project = await addProject(name, supabaseUrl, serviceKey)
    return successResponse(project, 201)
  } catch (e) {
    console.error('Failed to add keepalive project:', e)
    return errorResponse(e instanceof Error ? e.message : 'Failed to add project')
  }
}
