export default function Avatar({ src, alt, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28'
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className={size === '2xl' ? 'text-2xl' : size === 'xl' ? 'text-lg' : 'text-sm'}>
          {getInitials(alt || 'User')}
        </span>
      )}
    </div>
  )
}
