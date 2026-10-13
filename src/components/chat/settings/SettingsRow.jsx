export default function SettingsRow({ label, description, icon, children }) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-border">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="block font-medium text-foreground">{label}</span>
          {description && (
            <span className="block mt-1 text-sm text-muted-foreground">{description}</span>
          )}
        </div>
      </div>
      {children && (
        <div className="flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
