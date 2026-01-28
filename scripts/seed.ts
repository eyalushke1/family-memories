import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_KEY!
const SCHEMA = process.env.SUPABASE_SCHEMA ?? 'family_memories'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: SCHEMA },
})

async function seed() {
  console.log('Seeding database...')

  // Create profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .insert([
      { name: 'Mom', is_admin: true },
      { name: 'Dad', is_admin: true },
      { name: 'Kids', is_admin: false },
    ])
    .select('id, name')

  if (profileError) {
    console.error('Failed to seed profiles:', profileError)
    return
  }
  console.log('Created profiles:', profiles?.map((p) => p.name).join(', '))

  // Create categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .insert([
      { name: 'Summer 2024', slug: 'summer-2024', sort_order: 1 },
      { name: 'Birthday Parties', slug: 'birthday-parties', sort_order: 2 },
      { name: 'Holidays', slug: 'holidays', sort_order: 3 },
      { name: 'Throwbacks', slug: 'throwbacks', sort_order: 4 },
    ])
    .select('id, name')

  if (catError) {
    console.error('Failed to seed categories:', catError)
    return
  }
  console.log('Created categories:', categories?.map((c) => c.name).join(', '))

  // Create sample clips for each category
  if (!categories) return

  const clipData = categories.flatMap((cat, catIndex) => {
    const clipCount = catIndex === 0 ? 5 : catIndex === 1 ? 4 : 3
    return Array.from({ length: clipCount }, (_, i) => ({
      title: `${cat.name} - Clip ${i + 1}`,
      description: `A memorable moment from ${cat.name.toLowerCase()}`,
      category_id: cat.id,
      video_path: `videos/sample-${catIndex}-${i}.mp4`,
      thumbnail_path: `thumbnails/sample-${catIndex}-${i}.webp`,
      sort_order: i + 1,
      duration_seconds: 30 + Math.floor(Math.random() * 120),
    }))
  })

  const { error: clipError } = await supabase
    .from('clips')
    .insert(clipData)

  if (clipError) {
    console.error('Failed to seed clips:', clipError)
    return
  }
  console.log(`Created ${clipData.length} clips`)

  console.log('Seed complete!')
}

seed().catch(console.error)
