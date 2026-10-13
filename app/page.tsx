import { redirect } from 'next/navigation'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const params = await searchParams

  if (params.code) {
    redirect(`/auth/callback?code=${params.code}`)
  }

  redirect('/login')
}