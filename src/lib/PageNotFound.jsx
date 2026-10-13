import { Link } from 'react-router-dom'

export default function PageNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/" className="text-blue-500 hover:underline">
        Go back home
      </Link>
    </div>
  )
}
