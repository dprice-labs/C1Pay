import { Card, CardContent, CardHeader } from '@/components/ui/card'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 data-slot="card-title" className="font-heading text-base font-medium leading-snug">Sign in</h1>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
